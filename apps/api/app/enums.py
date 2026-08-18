from enum import StrEnum


class Role(StrEnum):
    ESTIMATOR = "ESTIMATOR"
    INSPECTOR = "INSPECTOR"
    MANAGER = "MANAGER"


class CaseStatus(StrEnum):
    NEW = "NEW"
    PRELIMINARY_QUOTED = "PRELIMINARY_QUOTED"
    AWAITING_DELIVERY = "AWAITING_DELIVERY"
    RECEIVED = "RECEIVED"
    INSPECTING = "INSPECTING"
    FINAL_QUOTED = "FINAL_QUOTED"
    PAID = "PAID"
    REJECTED = "REJECTED"
    ON_HOLD = "ON_HOLD"
    RETURN_REQUESTED = "RETURN_REQUESTED"
    RETURNED = "RETURNED"


class Grade(StrEnum):
    N = "N"
    A = "A"
    B = "B"
    C = "C"
    D = "D"
    JUNK = "JUNK"


class CheckResult(StrEnum):
    PASS = "PASS"
    FAIL = "FAIL"
    NOT_TESTED = "NOT_TESTED"


class ImportStatus(StrEnum):
    PREVIEW_VALID = "PREVIEW_VALID"
    PREVIEW_INVALID = "PREVIEW_INVALID"
    COMMITTED = "COMMITTED"
