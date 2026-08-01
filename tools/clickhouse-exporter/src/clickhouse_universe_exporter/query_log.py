from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from .clickhouse import QueryClient
from .models import LineageWindow, QueryObservation


def resolve_window(
    *,
    timezone_name: str,
    days: int | None,
    start_date: date | None,
    end_date: date | None,
    now: datetime | None = None,
) -> LineageWindow:
    try:
        zone = ZoneInfo(timezone_name)
    except ZoneInfoNotFoundError as error:
        raise ValueError(f"Unknown lineage timezone: {timezone_name}") from error
    current = (now or datetime.now(timezone.utc)).astimezone(zone)
    if days is not None:
        if start_date is not None or end_date is not None:
            raise ValueError("Use --lineage-days or --lineage-start/--lineage-end, not both")
        if days < 0:
            raise ValueError("--lineage-days must be non-negative")
        start = datetime.combine(current.date() - timedelta(days=days), time.min, zone)
        return LineageWindow(start, current, timezone_name)
    if start_date is None or end_date is None:
        raise ValueError(
            "Provide exactly one lineage window: --lineage-days or both "
            "--lineage-start and --lineage-end"
        )
    if start_date > end_date:
        raise ValueError("--lineage-start must not be later than --lineage-end")
    start = datetime.combine(start_date, time.min, zone)
    end_exclusive = datetime.combine(end_date + timedelta(days=1), time.min, zone)
    return LineageWindow(start, end_exclusive, timezone_name)


def collect_query_log(client: QueryClient, window: LineageWindow) -> list[QueryObservation]:
    rows = client.query_rows(
        """
        SELECT
          event_time,
          current_database,
          query,
          toString(normalized_query_hash) AS normalized_query_hash,
          query_id,
          initial_query_id
        FROM system.query_log
        WHERE type = 'QueryFinish'
          AND query_kind = 'Insert'
          AND is_initial_query = 1
          AND event_date >= toDate({start:DateTime})
          AND event_date <= toDate({last_day:DateTime})
          AND event_time >= {start:DateTime}
          AND event_time < {end_exclusive:DateTime}
        ORDER BY event_time, query_id
        """,
        {
            "start": window.start,
            "last_day": window.end_exclusive - timedelta(microseconds=1),
            "end_exclusive": window.end_exclusive,
        },
    )
    observations = [
        QueryObservation(
            event_time=row["event_time"],
            current_database=str(row["current_database"]),
            query=str(row["query"]),
            normalized_query_hash=str(row["normalized_query_hash"]),
            query_id=str(row["query_id"]),
            initial_query_id=str(row["initial_query_id"]),
        )
        for row in rows
    ]
    deduplicated: dict[tuple[str, str, datetime], QueryObservation] = {}
    for observation in observations:
        key = (
            observation.initial_query_id,
            observation.normalized_query_hash,
            observation.event_time,
        )
        deduplicated.setdefault(key, observation)
    return sorted(
        deduplicated.values(),
        key=lambda item: (item.event_time, item.initial_query_id, item.normalized_query_hash),
    )
