from datetime import UTC, date, datetime

from app.sla import add_business_days, business_days_between, sla_snapshot


def test_three_business_days_skip_weekend_and_configured_holiday():
    # Friday 10:00 Asia/Bangkok. Monday is configured as a holiday, so the
    # third business day is Thursday at the same local time.
    start = datetime(2026, 8, 14, 3, 0, tzinfo=UTC)
    due = add_business_days(start, 3, holidays={date(2026, 8, 17)})
    assert due == datetime(2026, 8, 20, 3, 0, tzinfo=UTC)
    assert business_days_between(start, due, holidays={date(2026, 8, 17)}) == 3


def test_sla_snapshot_reports_due_soon_and_overdue():
    due = datetime(2026, 8, 18, 3, 0, tzinfo=UTC)
    soon = sla_snapshot(due, now=datetime(2026, 8, 17, 3, 0, tzinfo=UTC))
    late = sla_snapshot(due, now=datetime(2026, 8, 18, 4, 0, tzinfo=UTC))
    assert soon["state"] == "DUE_SOON"
    assert late["state"] == "OVERDUE"
