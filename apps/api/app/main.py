from __future__ import annotations

import csv
import io
import mimetypes
import uuid
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, File, Query, Request, Response, UploadFile, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from openpyxl import Workbook
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from .config import get_settings
from .database import Base, SessionLocal, engine, get_db
from .enums import CaseStatus, ImportStatus, Role
from .errors import api_error
from .import_service import EXPECTED_HEADERS, parse_xlsx
from .models import Attachment, BuybackCase, ImportJob, ImportRow, Inspection, PartItem, StatusEvent, User
from .schemas import CaseCreateInput, ImportCommitInput, InspectionInput, LoginInput, TransitionInput
from .security import CurrentUser, clear_session_cookie, set_session_cookie, verify_password
from .seed import seed_demo_data
from .serializers import attachment_dict, case_dict, import_job_dict, inspection_dict, iso, user_dict
from .sla import sla_snapshot
from .workflow import TERMINAL, transition_case

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.auto_create_tables:
        Base.metadata.create_all(engine)
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    if settings.auto_seed:
        with SessionLocal() as db:
            seed_demo_data(db)
    yield


app = FastAPI(
    title="FA Reuse Flow API",
    version="0.1.0",
    description="API for a factory-automation reuse workflow using synthetic demo data.",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    field_errors: dict[str, str] = {}
    for error in exc.errors():
        location = ".".join(str(piece) for piece in error["loc"] if piece != "body") or "request"
        field_errors[location] = error["msg"]
    return JSONResponse(
        status_code=422,
        content={
            "detail": {
                "code": "VALIDATION_ERROR",
                "message": "ข้อมูลที่ส่งมาไม่ถูกต้อง",
                "field_errors": field_errors,
            }
        },
    )


CASE_OPTIONS = (
    selectinload(BuybackCase.parts),
    selectinload(BuybackCase.inspections).selectinload(Inspection.inspector),
    selectinload(BuybackCase.attachments),
    selectinload(BuybackCase.status_events).selectinload(StatusEvent.actor),
)


def load_case(db: Session, case_id: str) -> BuybackCase:
    case = db.scalar(select(BuybackCase).options(*CASE_OPTIONS).where(BuybackCase.id == case_id))
    if not case:
        raise api_error(404, "CASE_NOT_FOUND", "ไม่พบเคส")
    return case


def require_role(user: User, *roles: Role) -> None:
    if user.role not in roles:
        raise api_error(403, "FORBIDDEN", "บทบาทนี้ไม่มีสิทธิ์ดำเนินการ")


def _serial_conflicts(db: Session, serials: list[str]) -> list[str]:
    requested = {serial.casefold(): serial for serial in serials if serial}
    if not requested:
        return []
    existing = db.scalars(select(PartItem.serial_number).where(PartItem.serial_number.is_not(None))).all()
    return [requested[value.casefold()] for value in existing if value and value.casefold() in requested]


def create_case_record(
    db: Session,
    data: CaseCreateInput,
    actor: User,
    *,
    commit: bool = True,
) -> BuybackCase:
    serials = [part.serial_number for part in data.parts if part.serial_number]
    duplicate_in_request = {
        serial for serial in serials if sum(s.casefold() == serial.casefold() for s in serials) > 1
    }
    conflicts = sorted(set(_serial_conflicts(db, serials)) | duplicate_in_request)
    if conflicts:
        raise api_error(
            409,
            "DUPLICATE_SERIAL",
            "Serial number ซ้ำ",
            {"serial_number": conflicts},
        )
    case = BuybackCase(
        case_number=f"FA-{datetime.now(UTC):%Y%m%d}-{uuid.uuid4().hex[:6].upper()}",
        seller_ref=data.seller_ref.strip(),
        seller_name=data.seller_name.strip(),
        seller_contact=data.seller_contact.strip() if data.seller_contact else None,
        status=CaseStatus.NEW,
        parts=[PartItem(**part.model_dump()) for part in data.parts],
    )
    case.status_events.append(
        StatusEvent(actor=actor, from_status=None, to_status=CaseStatus.NEW, note="สร้างเคส")
    )
    db.add(case)
    try:
        if commit:
            db.commit()
        else:
            db.flush()
    except IntegrityError:
        db.rollback()
        raise api_error(409, "DUPLICATE_SERIAL", "Serial number มีอยู่ในระบบแล้ว") from None
    return load_case(db, case.id) if commit else case


@app.get("/health", tags=["operations"])
def health() -> dict:
    return {"status": "ok", "service": "fa-reuse-api", "version": app.version}


@app.get("/ready", tags=["operations"])
def ready(db: Annotated[Session, Depends(get_db)]) -> Response:
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        return JSONResponse(status_code=503, content={"status": "not_ready", "database": "unavailable"})
    return JSONResponse(content={"status": "ready", "database": "available"})


@app.post("/api/v1/auth/login", tags=["auth"])
def login(data: LoginInput, response: Response, db: Annotated[Session, Depends(get_db)]) -> dict:
    user = db.scalar(select(User).where(func.lower(User.username) == data.username.strip().lower()))
    if not user or not user.is_active or not verify_password(data.password, user.password_hash):
        raise api_error(401, "INVALID_CREDENTIALS", "อีเมลหรือรหัสผ่านไม่ถูกต้อง")
    set_session_cookie(response, user)
    return {"user": user_dict(user)}


@app.post("/api/v1/auth/logout", tags=["auth"])
def logout(response: Response) -> dict:
    clear_session_cookie(response)
    return {"message": "ออกจากระบบแล้ว"}


@app.get("/api/v1/auth/me", tags=["auth"])
def me(user: CurrentUser) -> dict:
    return {"user": user_dict(user)}


@app.get("/api/v1/cases", tags=["cases"])
def list_cases(
    _: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    case_status: Annotated[CaseStatus | None, Query(alias="status")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> dict:
    filters = [BuybackCase.status == case_status] if case_status else []
    total = db.scalar(select(func.count()).select_from(BuybackCase).where(*filters)) or 0
    cases = db.scalars(
        select(BuybackCase)
        .options(*CASE_OPTIONS)
        .where(*filters)
        .order_by(BuybackCase.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return {
        "items": [case_dict(case, include_detail=False) for case in cases],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@app.post("/api/v1/cases", status_code=status.HTTP_201_CREATED, tags=["cases"])
def create_case(
    data: CaseCreateInput,
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    require_role(user, Role.ESTIMATOR, Role.MANAGER)
    return case_dict(create_case_record(db, data, user))


@app.get("/api/v1/cases/{case_id}", tags=["cases"])
def get_case(case_id: str, _: CurrentUser, db: Annotated[Session, Depends(get_db)]) -> dict:
    return case_dict(load_case(db, case_id))


@app.post("/api/v1/cases/{case_id}/transition", tags=["workflow"])
def transition(
    case_id: str,
    data: TransitionInput,
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    case = load_case(db, case_id)
    transition_case(db, case, user, data)
    return case_dict(load_case(db, case_id))


@app.post("/api/v1/cases/{case_id}/inspections", status_code=201, tags=["qc"])
def create_inspection(
    case_id: str,
    data: InspectionInput,
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    require_role(user, Role.INSPECTOR, Role.MANAGER)
    case = load_case(db, case_id)
    if case.status != CaseStatus.INSPECTING:
        raise api_error(409, "INVALID_CASE_STATUS", "บันทึก QC ได้เฉพาะเคสที่กำลังตรวจสอบ")
    part = next((item for item in case.parts if item.id == data.part_item_id), None)
    if not part:
        raise api_error(404, "PART_NOT_FOUND", "ไม่พบ Part Item ในเคสนี้")
    inspection = Inspection(
        case=case,
        part_item=part,
        inspector=user,
        **data.model_dump(exclude={"part_item_id"}),
    )
    db.add(inspection)
    db.commit()
    db.refresh(inspection)
    return inspection_dict(inspection)


@app.get("/api/v1/cases/{case_id}/attachments", tags=["attachments"])
def list_attachments(case_id: str, _: CurrentUser, db: Annotated[Session, Depends(get_db)]) -> list[dict]:
    case = load_case(db, case_id)
    return [attachment_dict(item) for item in case.attachments]


@app.post("/api/v1/cases/{case_id}/attachments", status_code=201, tags=["attachments"])
async def upload_attachment(
    case_id: str,
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    file: UploadFile = File(...),
) -> dict:
    case = load_case(db, case_id)
    allowed_types = {"image/jpeg", "image/png", "image/webp", "application/pdf"}
    content_type = (
        file.content_type or mimetypes.guess_type(file.filename or "")[0] or "application/octet-stream"
    )
    if content_type not in allowed_types:
        raise api_error(422, "INVALID_ATTACHMENT_TYPE", "รองรับไฟล์ JPG, PNG, WebP และ PDF")
    content = await file.read(settings.max_upload_bytes + 1)
    if len(content) > settings.max_upload_bytes:
        raise api_error(413, "FILE_TOO_LARGE", "ไฟล์มีขนาดเกิน 5 MB")
    if not content:
        raise api_error(422, "EMPTY_FILE", "ไฟล์ว่างเปล่า")
    suffix = Path(file.filename or "file").suffix.lower()[:10]
    stored_filename = f"{uuid.uuid4().hex}{suffix}"
    destination = Path(settings.upload_dir) / stored_filename
    destination.write_bytes(content)
    attachment = Attachment(
        case=case,
        uploaded_by_id=user.id,
        original_filename=Path(file.filename or "attachment").name,
        stored_filename=stored_filename,
        content_type=content_type,
        size_bytes=len(content),
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    return attachment_dict(attachment)


@app.get("/api/v1/attachments/{attachment_id}/download", tags=["attachments"])
def download_attachment(
    attachment_id: str,
    _: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> FileResponse:
    attachment = db.get(Attachment, attachment_id)
    if not attachment:
        raise api_error(404, "ATTACHMENT_NOT_FOUND", "ไม่พบไฟล์แนบ")
    path = Path(settings.upload_dir) / attachment.stored_filename
    if not path.is_file():
        raise api_error(404, "ATTACHMENT_FILE_MISSING", "ไม่พบไฟล์ในพื้นที่จัดเก็บ")
    return FileResponse(path, media_type=attachment.content_type, filename=attachment.original_filename)


@app.get("/api/v1/imports/template.xlsx", tags=["imports"])
def download_import_template(_: CurrentUser) -> StreamingResponse:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "parts"
    sheet.append(EXPECTED_HEADERS)
    sheet.append(["SUP-001", "Mitsubishi", "FX5U-32MT/ES", "PLC", 1, "ใช้งานได้", "SN-001", "มีฝาครบ"])
    stream = io.BytesIO()
    workbook.save(stream)
    stream.seek(0)
    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="fa-reuse-import-template.xlsx"'},
    )


@app.post("/api/v1/imports", status_code=201, tags=["imports"])
async def preview_import(
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    file: UploadFile = File(...),
) -> dict:
    require_role(user, Role.ESTIMATOR, Role.MANAGER)
    content = await file.read(settings.max_upload_bytes + 1)
    if len(content) > settings.max_upload_bytes:
        raise api_error(413, "FILE_TOO_LARGE", "ไฟล์มีขนาดเกิน 5 MB")
    rows = parse_xlsx(content, file.filename or "upload.xlsx", db)
    all_valid = all(row["is_valid"] for row in rows)
    job = ImportJob(
        filename=Path(file.filename or "upload.xlsx").name,
        status=ImportStatus.PREVIEW_VALID if all_valid else ImportStatus.PREVIEW_INVALID,
        created_by_id=user.id,
        rows=[ImportRow(**row) for row in rows],
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return import_job_dict(job)


@app.get("/api/v1/imports/{job_id}", tags=["imports"])
def get_import(job_id: str, _: CurrentUser, db: Annotated[Session, Depends(get_db)]) -> dict:
    job = db.scalar(select(ImportJob).options(selectinload(ImportJob.rows)).where(ImportJob.id == job_id))
    if not job:
        raise api_error(404, "IMPORT_NOT_FOUND", "ไม่พบงาน Import")
    return import_job_dict(job)


@app.post("/api/v1/imports/{job_id}/commit", tags=["imports"])
def commit_import(
    job_id: str,
    data: ImportCommitInput,
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    require_role(user, Role.ESTIMATOR, Role.MANAGER)
    job = db.scalar(select(ImportJob).options(selectinload(ImportJob.rows)).where(ImportJob.id == job_id))
    if not job:
        raise api_error(404, "IMPORT_NOT_FOUND", "ไม่พบงาน Import")
    if job.status == ImportStatus.COMMITTED:
        raise api_error(409, "IMPORT_ALREADY_COMMITTED", "งาน Import นี้ถูกสร้างเคสแล้ว")
    if job.status != ImportStatus.PREVIEW_VALID or any(not row.is_valid for row in job.rows):
        raise api_error(409, "IMPORT_HAS_ERRORS", "ต้องแก้ไขข้อมูลใน Excel และอัปโหลดใหม่ก่อน Commit")
    serials = [row.data.get("serial_number") for row in job.rows if row.data.get("serial_number")]
    conflicts = _serial_conflicts(db, serials)
    if conflicts:
        raise api_error(
            409,
            "DUPLICATE_SERIAL",
            "Serial number ถูกเพิ่มเข้าระบบหลัง Preview",
            {"serial_number": conflicts},
        )
    seller_ref = job.rows[0].data["seller_ref"]
    create_input = CaseCreateInput(
        seller_ref=seller_ref,
        seller_name=data.seller_name,
        seller_contact=data.seller_contact,
        parts=[
            {
                "brand": row.data["brand"],
                "model": row.data["model"],
                "category": row.data["category"],
                "quantity": row.data["quantity"],
                "claimed_condition": row.data["claimed_condition"],
                "serial_number": row.data.get("serial_number"),
                "notes": row.data.get("notes"),
            }
            for row in job.rows
        ],
    )
    case = create_case_record(db, create_input, user, commit=False)
    job.status = ImportStatus.COMMITTED
    job.committed_case_id = case.id
    job.committed_at = datetime.now(UTC)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise api_error(409, "DUPLICATE_SERIAL", "Serial number ถูกเพิ่มเข้าระบบพร้อมกัน") from None
    return {"job": import_job_dict(job), "case": case_dict(load_case(db, case.id))}


@app.get("/api/v1/dashboard/summary", tags=["dashboard"])
def dashboard(_: CurrentUser, db: Annotated[Session, Depends(get_db)]) -> dict:
    cases = db.scalars(select(BuybackCase).options(selectinload(BuybackCase.parts))).all()
    status_counts = {state.value: 0 for state in CaseStatus}
    overdue = 0
    due_soon = 0
    completed_hours: list[float] = []
    for case in cases:
        status_counts[case.status.value] += 1
        if case.status not in TERMINAL:
            state = sla_snapshot(case.inspection_due_at)["state"]
            overdue += state == "OVERDUE"
            due_soon += state == "DUE_SOON"
        if case.completed_at and case.created_at:
            created = case.created_at.replace(tzinfo=case.created_at.tzinfo or UTC)
            completed = case.completed_at.replace(tzinfo=case.completed_at.tzinfo or UTC)
            completed_hours.append((completed - created).total_seconds() / 3600)
    return {
        "open_cases": sum(case.status not in TERMINAL for case in cases),
        "overdue_cases": overdue,
        "due_soon_cases": due_soon,
        "total_cases": len(cases),
        "average_cycle_hours": round(sum(completed_hours) / len(completed_hours), 1)
        if completed_hours
        else None,
        "status_counts": status_counts,
        "generated_at": datetime.now(UTC).isoformat(),
        "data_notice": "คำนวณจากข้อมูลสังเคราะห์สำหรับการสาธิต",
    }


def _report_rows(db: Session) -> list[dict]:
    cases = db.scalars(
        select(BuybackCase).options(*CASE_OPTIONS).order_by(BuybackCase.created_at.desc())
    ).all()
    return [
        {
            "case_number": case.case_number,
            "seller_ref": case.seller_ref,
            "seller_name": case.seller_name,
            "status": case.status.value,
            "item_count": sum(part.quantity for part in case.parts),
            "preliminary_quote": float(case.preliminary_quote)
            if case.preliminary_quote is not None
            else None,
            "final_quote": float(case.final_quote) if case.final_quote is not None else None,
            "received_at": iso(case.received_at),
            "inspection_due_at": iso(case.inspection_due_at),
            "sla_state": sla_snapshot(case.inspection_due_at)["state"],
            "created_at": iso(case.created_at),
            "completed_at": iso(case.completed_at),
        }
        for case in cases
    ]


@app.get("/api/v1/reports/cases", tags=["reports"])
def cases_report(_: CurrentUser, db: Annotated[Session, Depends(get_db)]) -> dict:
    rows = _report_rows(db)
    return {
        "title": "รายงานสถานะ FA Reuse Flow",
        "generated_at": datetime.now(UTC).isoformat(),
        "data_notice": "ข้อมูลสังเคราะห์สำหรับการสาธิต",
        "total": len(rows),
        "rows": rows,
    }


@app.get("/api/v1/reports/cases.csv", tags=["reports"])
def cases_csv(_: CurrentUser, db: Annotated[Session, Depends(get_db)]) -> StreamingResponse:
    rows = _report_rows(db)
    output = io.StringIO(newline="")
    fields = list(rows[0].keys()) if rows else ["case_number", "seller_ref", "seller_name", "status"]
    writer = csv.DictWriter(output, fieldnames=fields)
    writer.writeheader()
    writer.writerows(rows)
    content = "\ufeff" + output.getvalue()
    return StreamingResponse(
        iter([content.encode("utf-8")]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="fa-reuse-cases.csv"'},
    )
