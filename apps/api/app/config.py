from datetime import date
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "FA Reuse Flow API"
    environment: str = "development"
    database_url: str = "sqlite:///./fa_reuse.db"
    session_secret: str = "local-demo-secret-change-me"
    session_cookie_name: str = "fa_reuse_session"
    session_max_age_seconds: int = 60 * 60 * 8
    session_cookie_secure: bool = False
    cors_origins: str = "http://localhost:3000"
    upload_dir: str = "./uploads"
    app_timezone: str = "Asia/Bangkok"
    business_holidays: str = ""
    max_upload_bytes: int = 5 * 1024 * 1024
    auto_create_tables: bool = True
    auto_seed: bool = True

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def business_holiday_dates(self) -> set[date]:
        return {
            date.fromisoformat(item.strip()) for item in self.business_holidays.split(",") if item.strip()
        }


@lru_cache
def get_settings() -> Settings:
    return Settings()
