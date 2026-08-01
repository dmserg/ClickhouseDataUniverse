from typing import Any

from clickhouse_universe_exporter.discovery import (
    discover_databases,
    discover_part_sizes,
    discover_tables,
)
from clickhouse_universe_exporter.models import QualifiedName


class RecordingClient:
    def __init__(self) -> None:
        self.calls: list[tuple[str, dict[str, Any]]] = []

    def query_rows(self, sql: str, parameters=None) -> list[dict[str, Any]]:
        parameters = dict(parameters or {})
        self.calls.append((sql, parameters))
        if "FROM system.databases" in sql:
            return [
                {"name": "analytics"},
                {"name": "INFORMATION_SCHEMA"},
                {"name": "system"},
            ]
        if "FROM system.tables" in sql:
            return [
                {"database": "analytics", "name": "orders", "engine": "MergeTree"},
                {"database": "system", "name": "tables", "engine": "SystemTables"},
            ]
        if "FROM system.parts" in sql:
            return [
                {
                    "database": "analytics",
                    "table": "orders",
                    "rows": 10,
                    "compressed_bytes": 100,
                    "uncompressed_bytes": 200,
                },
                {
                    "database": "system",
                    "table": "query_log",
                    "rows": 20,
                    "compressed_bytes": 300,
                    "uncompressed_bytes": 400,
                },
            ]
        raise AssertionError(sql)

    def close(self) -> None:
        pass


def test_system_schema_is_excluded_from_database_selection() -> None:
    client = RecordingClient()
    assert discover_databases(client, [], []) == ["analytics"]
    assert discover_databases(client, ["analytics", "system"], []) == ["analytics"]


def test_system_schema_is_removed_before_object_queries_and_from_results() -> None:
    client = RecordingClient()
    tables = discover_tables(
        client,
        ["system", "analytics"],
        {"database", "name", "engine"},
    )
    assert [table.name for table in tables] == [QualifiedName("analytics", "orders")]
    assert client.calls[-1][1]["databases"] == ["analytics"]

    sizes = discover_part_sizes(client, ["SYSTEM", "analytics"])
    assert set(sizes) == {QualifiedName("analytics", "orders")}
    assert client.calls[-1][1]["databases"] == ["analytics"]


def test_only_system_schema_skips_object_queries() -> None:
    client = RecordingClient()
    assert discover_tables(client, ["system"], {"database", "name", "engine"}) == []
    assert discover_part_sizes(client, ["system"]) == {}
    assert client.calls == []
