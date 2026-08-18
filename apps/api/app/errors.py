from typing import Any

from fastapi import HTTPException


def api_error(
    status_code: int,
    code: str,
    message: str,
    field_errors: dict[str, Any] | None = None,
) -> HTTPException:
    detail: dict[str, Any] = {"code": code, "message": message}
    if field_errors:
        detail["field_errors"] = field_errors
    return HTTPException(status_code=status_code, detail=detail)
