from clickhouse_universe_exporter.models import QualifiedName
from clickhouse_universe_exporter.parsing.sql import (
    find_view_sources,
    parse_insert_select,
)


def test_view_sources_handle_joins_ctes_and_quoted_identifiers() -> None:
    sources = find_view_sources(
        """
        WITH recent AS (SELECT * FROM `raw`.`orders`)
        SELECT * FROM recent
        JOIN "reference"."customers" AS c ON c.id = recent.customer_id
        """,
        "analytics",
    )
    assert sources == {
        QualifiedName("raw", "orders"),
        QualifiedName("reference", "customers"),
    }


def test_insert_select_extracts_destination_and_union_sources() -> None:
    parsed = parse_insert_select(
        """
        INSERT INTO analytics.orders_daily
        SELECT * FROM raw.orders
        UNION ALL
        SELECT * FROM archive.orders
        """,
        "default",
    )
    assert parsed is not None
    assert parsed.destination == QualifiedName("analytics", "orders_daily")
    assert parsed.sources == {
        QualifiedName("raw", "orders"),
        QualifiedName("archive", "orders"),
    }


def test_insert_values_is_ignored() -> None:
    assert parse_insert_select("INSERT INTO t VALUES (1)", "default") is None
