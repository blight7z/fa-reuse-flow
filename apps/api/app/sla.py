from collections.abc import Collection
from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from .config import get_settings


def _aware_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def add_business_days(
    value: datetime,
    days: int = 3,
    holidays: Collection[date] | None = None,
) -> datetime:
    zone = ZoneInfo(get_settings().app_timezone)
    holidays = get_settings().business_holiday_dates if holidays is None else set(holidays)
    cursor = _aware_utc(value).astimezone(zone)
    added = 0
    while added < days:
        cursor += timedelta(days=1)
        if cursor.weekday() < 5 and cursor.date() not in holidays:
            added += 1
    return cursor.astimezone(UTC)


def business_days_between(
    start: datetime,
    end: datetime,
    holidays: Collection[date] | None = None,
) -> int:
    zone = ZoneInfo(get_settings().app_timezone)
    holidays = get_settings().business_holiday_dates if holidays is None else set(holidays)
    start_date = _aware_utc(start).astimezone(zone).date()
    end_date = _aware_utc(end).astimezone(zone).date()
    if end_date == start_date:
        return 0
    sign = 1 if end_date > start_date else -1
    cursor = start_date
    count = 0
    while cursor != end_date:
        cursor += timedelta(days=sign)
        if cursor.weekday() < 5 and cursor not in holidays:
            count += sign
    return count


def sla_snapshot(due_at: datetime | None, now: datetime | None = None) -> dict:
    if not due_at:
        return {"due_at": None, "state": "NOT_STARTED", "business_days_remaining": None}
    now = now or datetime.now(UTC)
    due_utc = _aware_utc(due_at)
    remaining = business_days_between(now, due_utc)
    if now > due_utc:
        state = "OVERDUE"
    elif remaining <= 1:
        state = "DUE_SOON"
    else:
        state = "ON_TRACK"
    return {
        "due_at": due_utc.isoformat(),
        "state": state,
        "business_days_remaining": remaining,
    }
