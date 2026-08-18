from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy.orm import Session

from .enums import CaseStatus, Role
from .errors import api_error
from .models import BuybackCase, StatusEvent, User
from .schemas import TransitionInput
from .sla import add_business_days

STANDARD_TRANSITIONS: dict[CaseStatus, dict[CaseStatus, set[Role]]] = {
    CaseStatus.NEW: {
        CaseStatus.PRELIMINARY_QUOTED: {Role.ESTIMATOR, Role.MANAGER},
        CaseStatus.REJECTED: {Role.ESTIMATOR, Role.MANAGER},
    },
    CaseStatus.PRELIMINARY_QUOTED: {
        CaseStatus.AWAITING_DELIVERY: {Role.ESTIMATOR, Role.MANAGER},
        CaseStatus.REJECTED: {Role.ESTIMATOR, Role.MANAGER},
    },
    CaseStatus.AWAITING_DELIVERY: {
        CaseStatus.RECEIVED: {Role.ESTIMATOR, Role.MANAGER},
    },
    CaseStatus.RECEIVED: {CaseStatus.INSPECTING: {Role.INSPECTOR, Role.MANAGER}},
    CaseStatus.INSPECTING: {CaseStatus.FINAL_QUOTED: {Role.ESTIMATOR, Role.MANAGER}},
    CaseStatus.FINAL_QUOTED: {
        CaseStatus.PAID: {Role.MANAGER},
        CaseStatus.RETURN_REQUESTED: {Role.ESTIMATOR, Role.MANAGER},
    },
    CaseStatus.RETURN_REQUESTED: {CaseStatus.RETURNED: {Role.MANAGER}},
}

TERMINAL = {CaseStatus.PAID, CaseStatus.REJECTED, CaseStatus.RETURNED}
HOLDABLE = {
    CaseStatus.NEW,
    CaseStatus.PRELIMINARY_QUOTED,
    CaseStatus.AWAITING_DELIVERY,
    CaseStatus.RECEIVED,
    CaseStatus.INSPECTING,
}


def _has_complete_qc(case: BuybackCase) -> bool:
    inspected_part_ids = {inspection.part_item_id for inspection in case.inspections}
    return bool(case.parts) and all(part.id in inspected_part_ids for part in case.parts)


def transition_case(
    db: Session,
    case: BuybackCase,
    actor: User,
    data: TransitionInput,
    now: datetime | None = None,
) -> BuybackCase:
    now = now or datetime.now(UTC)
    target = data.to_status
    current = case.status
    note = data.note.strip() if data.note else None

    if current in TERMINAL:
        raise api_error(409, "TERMINAL_CASE", "เคสที่จบแล้วไม่สามารถเปลี่ยนสถานะได้")
    if target == CaseStatus.ON_HOLD:
        if current not in HOLDABLE:
            raise api_error(409, "INVALID_TRANSITION", f"พักเคสจาก {current.value} ไม่ได้")
        if current == CaseStatus.ON_HOLD:
            raise api_error(409, "INVALID_TRANSITION", "เคสอยู่ในสถานะพักอยู่แล้ว")
        if not note:
            raise api_error(422, "REASON_REQUIRED", "กรุณาระบุเหตุผลที่พักเคส", {"note": "required"})
        case.previous_status = current
        case.hold_reason = note
    elif current == CaseStatus.ON_HOLD:
        if actor.role != Role.MANAGER:
            raise api_error(403, "FORBIDDEN", "เฉพาะ Manager ที่เปิดเคสจากการพักได้")
        if target != case.previous_status:
            raise api_error(409, "INVALID_TRANSITION", "ต้องกลับไปยังสถานะก่อนพักเคส")
        case.previous_status = None
        case.hold_reason = None
    else:
        roles = STANDARD_TRANSITIONS.get(current, {}).get(target)
        if roles is None:
            raise api_error(409, "INVALID_TRANSITION", f"เปลี่ยนจาก {current.value} ไป {target.value} ไม่ได้")
        if actor.role not in roles:
            raise api_error(403, "FORBIDDEN", "บทบาทนี้ไม่มีสิทธิ์เปลี่ยนสถานะดังกล่าว")

    if target in {CaseStatus.REJECTED, CaseStatus.RETURN_REQUESTED} and not note:
        raise api_error(422, "REASON_REQUIRED", "กรุณาระบุเหตุผล", {"note": "required"})
    if target == CaseStatus.PRELIMINARY_QUOTED:
        quote = data.preliminary_quote
        if quote is None:
            raise api_error(422, "QUOTE_REQUIRED", "กรุณาระบุราคาเบื้องต้น", {"preliminary_quote": "required"})
        case.preliminary_quote = Decimal(quote)
    if target == CaseStatus.RECEIVED:
        case.received_at = now
        case.inspection_due_at = add_business_days(now, 3)
    if target == CaseStatus.FINAL_QUOTED:
        if not _has_complete_qc(case):
            raise api_error(409, "QC_INCOMPLETE", "ต้องตรวจ QC ให้ครบทุก Part Item ก่อนเสนอราคาสุดท้าย")
        if data.final_quote is None:
            raise api_error(422, "QUOTE_REQUIRED", "กรุณาระบุราคาสุดท้าย", {"final_quote": "required"})
        case.final_quote = Decimal(data.final_quote)
    if target == CaseStatus.PAID:
        case.paid_at = now
        case.completed_at = now
    if target in {CaseStatus.REJECTED, CaseStatus.RETURNED}:
        case.completed_at = now
    if target in {CaseStatus.REJECTED, CaseStatus.RETURN_REQUESTED}:
        case.resolution_reason = note

    case.status = target
    db.add(
        StatusEvent(
            case=case,
            actor_id=actor.id,
            from_status=current,
            to_status=target,
            note=note,
        )
    )
    db.commit()
    db.refresh(case)
    return case
