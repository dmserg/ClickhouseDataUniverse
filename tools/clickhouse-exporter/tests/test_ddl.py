from clickhouse_universe_exporter.ddl import parse_distributed_engine
from clickhouse_universe_exporter.models import QualifiedName


def test_parses_static_distributed_reference() -> None:
    assert parse_distributed_engine("Distributed('cluster', `raw`, 'orders', rand())") == (
        "cluster",
        QualifiedName("raw", "orders"),
    )


def test_rejects_dynamic_distributed_reference() -> None:
    assert parse_distributed_engine("Distributed(cluster(), raw, orders)") is None
