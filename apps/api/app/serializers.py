from datetime import UTC, datetime
from decimal import Decimal

from .enums import CaseStatus
from .models import Attachment, BuybackCase, ImportJob, Inspection, PartItem, StatusEvent, User
from .sla import sla_snapshot


def iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.isoformat()


def money(value: Decimal | None) -> float | None:
    return float(value) if value is not None else None


def user_dict(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "role": user.role.value,
    }


def part_dict(part: PartItem) -> dict:
    return {
        "id": part.id,
        "brand": part.brand,
        "model": part.model,
        "category": part.category,
        "quantity": part.quantity,
        "claimed_condition": part.claimed_condition,
        "serial_number": part.serial_number,
        "notes": part.notes,
    }


def inspection_dict(inspection: Inspection) -> dict:
    return {
        "id": inspection.id,
        "case_id": inspection.case_id,
        "part_item_id": inspection.part_item_id,
        "inspector": user_dict(inspection.inspector),
        "inspector_name": inspection.inspector.full_name,
        "grade": inspection.grade.value,
        "power_result": inspection.power_result.value,
        "appearance_result": inspection.appearance_result.value,
        "serial_verified": inspection.serial_verified,
        "accessories_complete": inspection.accessories_complete,
        "notes": inspection.notes,
        "created_at": iso(inspection.created_at),
    }


def attachment_dict(attachment: Attachment) -> dict:
    url = f"/api/v1/attachments/{attachment.id}/download"
    return {
        "id": attachment.id,
        "filename": attachment.original_filename,
        "original_filename": attachment.original_filename,
        "content_type": attachment.content_type,
        "size_bytes": attachment.size_bytes,
        "created_at": iso(attachment.created_at),
        "url": url,
        "download_url": url,
    }


def event_dict(event: StatusEvent) -> dict:
    return {
        "id": event.id,
        "from_status": event.from_status.value if event.from_status else None,
        "to_status": event.to_status.value,
        "note": event.note,
        "actor": user_dict(event.actor),
        "actor_name": event.actor.full_name,
        "actor_role": event.actor.role.value,
        "created_at": iso(event.created_at),
    }


def case_dict(case: BuybackCase, *, include_detail: bool = True) -> dict:
    sla = sla_snapshot(case.inspection_due_at)
    if case.status in {CaseStatus.PAID, CaseStatus.REJECTED, CaseStatus.RETURNED} and case.completed_at:
        sla["state"] = "COMPLETED"
    payload = {
        "id": case.id,
        "case_number": case.case_number,
        "seller_ref": case.seller_ref,
        "seller_name": case.seller_name,
        "seller_contact": case.seller_contact,
        "status": case.status.value,
        "previous_status": case.previous_status.value if case.previous_status else None,
        "preliminary_quote": money(case.preliminary_quote),
        "final_quote": money(case.final_quote),
        "hold_reason": case.hold_reason,
        "resolution_reason": case.resolution_reason,
        "received_at": iso(case.received_at),
        "inspection_due_at": iso(case.inspection_due_at),
        "paid_at": iso(case.paid_at),
        "completed_at": iso(case.completed_at),
        "created_at": iso(case.created_at),
        "updated_at": iso(case.updated_at),
        "item_count": sum(part.quantity for part in case.parts),
        "sla": sla,
    }
    if include_detail:
        payload.update(
            {
                "parts": [part_dict(part) for part in case.parts],
                "inspections": [inspection_dict(item) for item in case.inspections],
                "attachments": [attachment_dict(item) for item in case.attachments],
                "status_events": [event_dict(item) for item in case.status_events],
            }
        )
    return payload


def import_job_dict(job: ImportJob) -> dict:
    valid_rows = sum(row.is_valid for row in job.rows)
    return {
        "id": job.id,
        "filename": job.filename,
        "status": job.status.value,
        "total_rows": len(job.rows),
        "valid_rows": valid_rows,
        "invalid_rows": len(job.rows) - valid_rows,
        "committed_case_id": job.committed_case_id,
        "created_at": iso(job.created_at),
        "committed_at": iso(job.committed_at),
        "rows": [
            {
                "row_number": row.row_number,
                "data": row.data,
                "is_valid": row.is_valid,
                "field_errors": row.field_errors,
            }
            for row in job.rows
        ],
    }
