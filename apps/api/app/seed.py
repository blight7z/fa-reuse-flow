from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from .database import Base, SessionLocal, engine
from .enums import CaseStatus, CheckResult, Grade, Role
from .models import BuybackCase, Inspection, PartItem, StatusEvent, User
from .security import hash_password

DEMO_ACCOUNTS = (
    ("estimator@demo.local", "พิมพ์ชนก ประเมินราคา", Role.ESTIMATOR),
    ("inspector@demo.local", "กิตติพงศ์ ตรวจสอบ", Role.INSPECTOR),
    ("manager@demo.local", "อรุณ ผู้จัดการ", Role.MANAGER),
)


def seed_users(db: Session) -> dict[Role, User]:
    users: dict[Role, User] = {}
    for username, full_name, role in DEMO_ACCOUNTS:
        user = db.scalar(select(User).where(User.username == username))
        if not user:
            user = User(
                username=username,
                full_name=full_name,
                role=role,
                password_hash=hash_password("Demo123!"),
            )
            db.add(user)
            db.flush()
        users[role] = user
    db.commit()
    return users


def _event(case: BuybackCase, actor: User, target: CaseStatus, note: str) -> StatusEvent:
    return StatusEvent(case=case, actor=actor, from_status=None, to_status=target, note=note)


def seed_demo_data(db: Session, *, include_samples: bool = True) -> None:
    users = seed_users(db)
    if not include_samples or db.scalar(select(BuybackCase.id).limit(1)):
        return
    now = datetime.now(UTC)

    new_case = BuybackCase(
        case_number="FA-DEMO-001",
        seller_ref="SUP-DEMO-001",
        seller_name="บริษัท สมาร์ทแฟคทอรี่ จำกัด",
        seller_contact="purchasing@example.test",
        status=CaseStatus.NEW,
        created_at=now - timedelta(days=1),
        parts=[
            PartItem(
                brand="Mitsubishi",
                model="FX5U-32MT/ES",
                category="PLC",
                quantity=1,
                claimed_condition="ถอดจากไลน์ที่ใช้งานได้",
                serial_number="DEMO-PLC-001",
                notes="มีฝาครบ",
            )
        ],
    )
    new_case.status_events.append(
        _event(new_case, users[Role.ESTIMATOR], CaseStatus.NEW, "ข้อมูลสังเคราะห์สำหรับเดโม")
    )

    inspecting = BuybackCase(
        case_number="FA-DEMO-002",
        seller_ref="SUP-DEMO-002",
        seller_name="โรงงานตัวอย่าง บางนา",
        status=CaseStatus.INSPECTING,
        created_at=now - timedelta(days=4),
        preliminary_quote=18_500,
        received_at=now - timedelta(days=2),
        inspection_due_at=now + timedelta(hours=8),
        parts=[
            PartItem(
                brand="Keyence",
                model="IV3-G120",
                category="Vision Sensor",
                quantity=1,
                claimed_condition="มีรอยใช้งานเล็กน้อย",
                serial_number="DEMO-VIS-002",
            ),
            PartItem(
                brand="Omron",
                model="CJ2M-CPU31",
                category="PLC",
                quantity=1,
                claimed_condition="ไม่ทราบผล Power",
                serial_number="DEMO-PLC-003",
            ),
        ],
    )
    inspecting.status_events.append(
        _event(inspecting, users[Role.INSPECTOR], CaseStatus.INSPECTING, "กำลังรอผล QC รายการสุดท้าย")
    )

    overdue = BuybackCase(
        case_number="FA-DEMO-003",
        seller_ref="SUP-DEMO-003",
        seller_name="ผู้ขายตัวอย่าง สมุทรปราการ",
        status=CaseStatus.RECEIVED,
        created_at=now - timedelta(days=7),
        preliminary_quote=7_200,
        received_at=now - timedelta(days=6),
        inspection_due_at=now - timedelta(days=1),
        parts=[
            PartItem(
                brand="SMC",
                model="ITV2030-312L",
                category="Electro-pneumatic Regulator",
                quantity=2,
                claimed_condition="ใช้งานแล้ว",
                serial_number="DEMO-SMC-004",
            )
        ],
    )
    overdue.status_events.append(_event(overdue, users[Role.ESTIMATOR], CaseStatus.RECEIVED, "รอผู้ตรวจรับงาน"))

    paid = BuybackCase(
        case_number="FA-DEMO-004",
        seller_ref="SUP-DEMO-004",
        seller_name="บริษัท เดโมออโตเมชัน จำกัด",
        status=CaseStatus.PAID,
        created_at=now - timedelta(days=8),
        preliminary_quote=12_000,
        final_quote=10_500,
        received_at=now - timedelta(days=8),
        inspection_due_at=now - timedelta(days=5),
        paid_at=now - timedelta(days=3),
        completed_at=now - timedelta(days=3),
        parts=[
            PartItem(
                brand="Siemens",
                model="6ES7214-1AG40-0XB0",
                category="PLC",
                quantity=1,
                claimed_condition="พร้อมใช้งาน",
                serial_number="DEMO-SIE-005",
            )
        ],
    )
    paid.status_events.append(_event(paid, users[Role.MANAGER], CaseStatus.PAID, "ข้อมูลสังเคราะห์: ชำระเงินแล้ว"))
    db.add_all([new_case, inspecting, overdue, paid])
    db.flush()
    paid.inspections.append(
        Inspection(
            part_item_id=paid.parts[0].id,
            inspector=users[Role.INSPECTOR],
            grade=Grade.B,
            power_result=CheckResult.PASS,
            appearance_result=CheckResult.PASS,
            serial_verified=True,
            accessories_complete=True,
            notes="ข้อมูล QC สังเคราะห์",
        )
    )
    db.commit()


def main() -> None:
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed_demo_data(db)
    print("Seed complete: estimator/inspector/manager @demo.local, password Demo123!")


if __name__ == "__main__":
    main()
