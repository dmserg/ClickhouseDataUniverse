from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from .clickhouse import ClickHouseError, QueryClient
from .models import PartSize, QualifiedName, TableSnapshot

SYSTEM_DATABASES = {"system", "INFORMATION_SCHEMA", "information_schema"}
_SYSTEM_DATABASE_NAMES = {database.casefold() for database in SYSTEM_DATABASES}
TABLE_COLUMNS = (
    "database",
    "name",
    "engine",
    "engine_full",
    "has_own_data",
    "create_table_query",
    "as_select",
    "comment",
    "total_rows",
    "total_bytes",
    "target_database",
    "target_table",
    "is_temporary",
)


def probe(client: QueryClient) -> tuple[str, str, set[str]]:
    version_rows = client.query_rows("SELECT version() AS version, timezone() AS timezone")
    if not version_rows:
        raise RuntimeError("ClickHouse returned no version information")
    columns = client.query_rows(
        """
        SELECT name
        FROM system.columns
        WHERE database = 'system' AND table = 'tables'
        """
    )
    if not columns:
        # Public/least-privilege servers can hide system-table rows from
        # system.columns while still allowing DESCRIBE on the table itself.
        try:
            columns = client.query_rows("DESCRIBE TABLE system.tables")
        except ClickHouseError:
            columns = []
    if not columns:
        # Last-resort capability probe. Names come only from the exporter-owned
        # allow-list, never from user input.
        available: list[dict[str, str]] = []
        for candidate in TABLE_COLUMNS:
            try:
                client.query_rows(f"SELECT {candidate} FROM system.tables LIMIT 0")
                available.append({"name": candidate})
            except ClickHouseError:
                continue
        columns = available
    return (
        str(version_rows[0]["version"]),
        str(version_rows[0]["timezone"]),
        {str(row["name"]) for row in columns},
    )


def discover_databases(
    client: QueryClient, includes: Iterable[str], excludes: Iterable[str]
) -> list[str]:
    available = {
        str(row["name"])
        for row in client.query_rows("SELECT name FROM system.databases ORDER BY name")
    }
    requested = set(includes)
    unknown = requested - available
    if unknown:
        raise ValueError(f"Included databases do not exist: {', '.join(sorted(unknown))}")
    selected = requested or available
    excluded = {database.casefold() for database in excludes} | _SYSTEM_DATABASE_NAMES
    selected = {database for database in selected if database.casefold() not in excluded}
    if not selected:
        raise ValueError("Database filters selected no databases")
    return sorted(selected)


def discover_tables(
    client: QueryClient, databases: list[str], available_columns: set[str]
) -> list[TableSnapshot]:
    databases = _exportable_databases(databases)
    if not databases:
        return []
    projection = [column for column in TABLE_COLUMNS if column in available_columns]
    required = {"database", "name", "engine"}
    if not required <= set(projection):
        raise RuntimeError("system.tables is missing required database/name/engine columns")
    rows = client.query_rows(
        f"""
        SELECT {", ".join(projection)}
        FROM system.tables
        WHERE database IN {{databases:Array(String)}}
        ORDER BY database, name
        """,
        {"databases": databases},
    )
    snapshots: list[TableSnapshot] = []
    for row in rows:
        database = str(row["database"])
        if database.casefold() in _SYSTEM_DATABASE_NAMES or bool(row.get("is_temporary", False)):
            continue
        snapshots.append(
            TableSnapshot(
                name=QualifiedName(database, str(row["name"])),
                engine=str(row["engine"]),
                engine_full=str(row.get("engine_full") or ""),
                has_own_data=_optional_bool(row.get("has_own_data")),
                create_table_query=str(row.get("create_table_query") or ""),
                as_select=str(row.get("as_select") or ""),
                comment=str(row.get("comment") or ""),
                total_rows=_optional_int(row.get("total_rows")),
                total_bytes=_optional_int(row.get("total_bytes")),
                target_database=str(row.get("target_database") or ""),
                target_table=str(row.get("target_table") or ""),
            )
        )
    return snapshots


def discover_part_sizes(client: QueryClient, databases: list[str]) -> dict[QualifiedName, PartSize]:
    databases = _exportable_databases(databases)
    if not databases:
        return {}
    rows = client.query_rows(
        """
        SELECT
          database,
          table,
          sum(rows) AS rows,
          sum(data_compressed_bytes) AS compressed_bytes,
          sum(data_uncompressed_bytes) AS uncompressed_bytes
        FROM system.parts
        WHERE active AND database IN {databases:Array(String)}
        GROUP BY database, table
        """,
        {"databases": databases},
    )
    return {
        QualifiedName(str(row["database"]), str(row["table"])): PartSize(
            rows=int(row["rows"]),
            compressed_bytes=int(row["compressed_bytes"]),
            uncompressed_bytes=int(row["uncompressed_bytes"]),
        )
        for row in rows
        if str(row["database"]).casefold() not in _SYSTEM_DATABASE_NAMES
    }


def _optional_int(value: Any) -> int | None:
    return None if value is None else int(value)


def _optional_bool(value: Any) -> bool | None:
    return None if value is None else bool(value)


def _exportable_databases(databases: Iterable[str]) -> list[str]:
    return sorted(
        {
            database
            for database in databases
            if database.casefold() not in _SYSTEM_DATABASE_NAMES
        }
    )
