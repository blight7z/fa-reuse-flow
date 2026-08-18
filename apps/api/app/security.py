import hashlib
import hmac
import os
from typing import Annotated

from fastapi import Cookie, Depends, Response
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import get_settings
from .database import get_db
from .errors import api_error
from .models import User


def hash_password(password: str, *, iterations: int = 310_000) -> str:
    salt = os.urandom(16)
    derived = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, iterations)
    return f"pbkdf2_sha256${iterations}${salt.hex()}${derived.hex()}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, iterations, salt_hex, expected_hex = encoded.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), int(iterations))
        return hmac.compare_digest(actual, bytes.fromhex(expected_hex))
    except (ValueError, TypeError):
        return False


def _serializer() -> URLSafeTimedSerializer:
    settings = get_settings()
    return URLSafeTimedSerializer(settings.session_secret, salt="fa-reuse-session-v1")


def create_session_token(user: User) -> str:
    return _serializer().dumps({"sub": user.id, "role": user.role.value})


def set_session_cookie(response: Response, user: User) -> None:
    settings = get_settings()
    response.set_cookie(
        key=settings.session_cookie_name,
        value=create_session_token(user),
        max_age=settings.session_max_age_seconds,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(get_settings().session_cookie_name, path="/", httponly=True, samesite="lax")


def get_current_user(
    db: Annotated[Session, Depends(get_db)],
    fa_reuse_session: Annotated[str | None, Cookie()] = None,
) -> User:
    if not fa_reuse_session:
        raise api_error(401, "AUTH_REQUIRED", "กรุณาเข้าสู่ระบบ")
    settings = get_settings()
    try:
        payload = _serializer().loads(fa_reuse_session, max_age=settings.session_max_age_seconds)
    except SignatureExpired:
        raise api_error(401, "SESSION_EXPIRED", "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง") from None
    except BadSignature:
        raise api_error(401, "INVALID_SESSION", "เซสชันไม่ถูกต้อง") from None
    user = db.scalar(select(User).where(User.id == payload.get("sub"), User.is_active.is_(True)))
    if not user:
        raise api_error(401, "INVALID_SESSION", "ไม่พบบัญชีผู้ใช้ที่ใช้งานได้")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
