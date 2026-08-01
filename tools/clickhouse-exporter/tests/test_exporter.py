from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from clickhouse_universe_exporter.exporter import export_universe
from clickhouse_universe_exporter.models import LineageWindow
from clickhouse_universe_exporter.validation import validate_document
from clickhouse_universe_exporter.writer import write_json_atomic


class FakeClient:
    def query_rows(self, sql: str, parameters=None) -> list[dict[str, Any]]:
        if "version() AS version" in sql:
            return [{"version": "26.7.1", "timezone": "UTC"}]
        if "FROM system.columns" in sql:
            return [
                {"name": name}
                for name in (
                    "database",
                    "name",
                    "engine",
                    "engine_full",
                    "has_own_data",
                    "as_select",
                    "comment",
                    "total_rows",
                    "total_bytes",
                    "target_database",
                    "target_table",
                    "is_temporary",
                )
            ]
        if "FROM system.databases" in sql:
            return [{"name": "analytics"}, {"name": "raw"}, {"name": "system"}]
        if "FROM system.tables" in sql:
            return [
                {
                    "database": "analytics",
                    "name": "orders_view",
                    "engine": "View",
                    "engine_full": "",
                    "has_own_data": 0,
                    "as_select": "SELECT * FROM raw.orders",
                    "comment": "",
                    "total_rows": None,
                    "total_bytes": None,
                    "target_database": "",
                    "target_table": "",
                    "is_temporary": 0,
                },
                {
                    "database": "raw",
                    "name": "orders",
                    "engine": "MergeTree",
                    "engine_full": "MergeTree ORDER BY id",
                    "has_own_data": 1,
                    "as_select": "",
                    "comment": "",
                    "total_rows": 10,
                    "total_bytes": 100,
                    "target_database": "",
                    "target_table": "",
                    "is_temporary": 0,
                },
            ]
        if "FROM system.parts" in sql:
            return [
                {
                    "database": "raw",
                    "table": "orders",
                    "rows": 10,
                    "compressed_bytes": 100,
                    "uncompressed_bytes": 200,
                }
            ]
        if "FROM system.query_log" in sql:
            return []
        raise AssertionError(sql)

    def close(self) -> None:
        pass


def test_end_to_end_fixture_validates_and_writes_atomically(tmp_path: Path) -> None:
    generated = datetime(2026, 7, 30, tzinfo=timezone.utc)
    document, report = export_universe(
        FakeClient(),
        includes=[],
        excludes=[],
        window=LineageWindow(generated, generated, "UTC"),
        universe_id="fixture",
        universe_name="Fixture",
        layout_seed=42,
        generated_at=generated,
        supplement_path=None,
        strict=True,
    )
    validate_document(document)
    assert report.counts == {"schemas": 2, "nodes": 2, "edges": 1, "unresolved": 0}
    assert document["edges"][0]["type"] == "view_dependency"
    output = tmp_path / "universe.json"
    write_json_atomic(output, document)
    assert output.read_text(encoding="utf-8").endswith("\n")
