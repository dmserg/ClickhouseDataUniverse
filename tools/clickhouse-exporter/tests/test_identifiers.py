from clickhouse_universe_exporter.identifiers import edge_id, node_id, schema_id
from clickhouse_universe_exporter.models import QualifiedName


def test_ids_are_stable_and_distinguish_unusual_names() -> None:
    assert schema_id("Änalytics") == schema_id("Änalytics")
    assert node_id(QualifiedName("a.b", "c")) != node_id(QualifiedName("a", "b.c"))
    assert edge_id("one", "two", "etl_transfer") != edge_id(
        "two", "one", "etl_transfer"
    )
