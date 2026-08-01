from datetime import date, datetime, timezone

import pytest

from clickhouse_universe_exporter.query_log import resolve_window


def test_rolling_window_starts_at_local_midnight() -> None:
    now = datetime(2026, 3, 29, 12, tzinfo=timezone.utc)
    window = resolve_window(
        timezone_name="Europe/Berlin",
        days=1,
        start_date=None,
        end_date=None,
        now=now,
    )
    assert window.start.isoformat() == "2026-03-28T00:00:00+01:00"
    assert window.end_exclusive.isoformat() == "2026-03-29T14:00:00+02:00"


def test_explicit_end_is_exclusive_next_midnight_across_dst() -> None:
    window = resolve_window(
        timezone_name="Europe/Berlin",
        days=None,
        start_date=date(2026, 3, 28),
        end_date=date(2026, 3, 29),
    )
    assert window.start.isoformat() == "2026-03-28T00:00:00+01:00"
    assert window.end_exclusive.isoformat() == "2026-03-30T00:00:00+02:00"


def test_rejects_incomplete_explicit_window() -> None:
    with pytest.raises(ValueError, match="Provide exactly one"):
        resolve_window(
            timezone_name="UTC",
            days=None,
            start_date=date(2026, 1, 1),
            end_date=None,
        )
