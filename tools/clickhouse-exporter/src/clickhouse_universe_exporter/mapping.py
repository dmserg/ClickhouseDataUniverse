from __future__ import annotations

from typing import Any

from .ddl import parse_distributed_engine
from .identifiers import node_id, schema_id
from .models import ExtractionReport, PartSize, QualifiedName, TableSnapshot

EXTERNAL_ENGINES = {
    "AzureBlobStorage",
    "HDFS",
    "JDBC",
    "Kafka",
    "MongoDB",
    "MySQL",
    "NATS",
    "ODBC",
    "PostgreSQL",
    "RabbitMQ",
    "S3",
    "URL",
}
SPECIAL_ENGINES = {"Buffer", "Dictionary", "File", "Join", "KeeperMap", "Null", "Set"}
VIEW_ENGINES = {"View", "LiveView", "WindowView"}


def object_kind(table: TableSnapshot) -> str:
    if table.engine == "MaterializedView" or "MATERIALIZED VIEW" in table.create_table_query.upper():
        return "materialized_view"
    if table.engine in VIEW_ENGINES:
        return "view"
    if table.engine == "Distributed":
        return "distributed_table"
    if table.engine in EXTERNAL_ENGINES:
        return "external_table"
    if table.engine in SPECIAL_ENGINES:
        return "special_table"
    return "table" if table.has_own_data is not False else "special_table"


def engine_family(engine: str) -> str:
    if engine.endswith("MergeTree"):
        return "MergeTree"
    if engine in {"Log", "TinyLog", "StripeLog"}:
        return "Log"
    if engine == "Memory":
        return "Memory"
    if engine == "Distributed":
        return "Distributed"
    if engine in EXTERNAL_ENGINES:
        return "Integration"
    if engine in SPECIAL_ENGINES or engine in VIEW_ENGINES or engine == "MaterializedView":
        return "Special"
    return "Unknown"


def build_schemas(databases: list[str]) -> list[dict[str, Any]]:
    return sorted(
        (
            {"id": schema_id(database), "name": database, "displayName": database}
            for database in databases
        ),
        key=lambda item: item["id"],
    )


def build_nodes(
    tables: list[TableSnapshot],
    parts: dict[QualifiedName, PartSize],
    report: ExtractionReport,
) -> tuple[list[dict[str, Any]], dict[QualifiedName, str]]:
    ids = {table.name: node_id(table.name) for table in tables}
    nodes: list[dict[str, Any]] = []
    for table in tables:
        kind = object_kind(table)
        family = engine_family(table.engine)
        if family == "Unknown":
            report.unknown_engines.append(table.engine)
        node: dict[str, Any] = {
            "id": ids[table.name],
            "schemaId": schema_id(table.name.database),
            "name": table.name.table,
            "qualifiedName": table.name.text,
            "kind": kind,
        }
        if table.comment:
            node["description"] = table.comment
        if kind == "view":
            view_type = {"LiveView": "live", "WindowView": "window"}.get(table.engine, "normal")
            node["view"] = {"viewType": view_type}
        elif kind == "materialized_view":
            node["materializedView"] = {
                "mode": (
                    "refreshable"
                    if "REFRESH" in table.create_table_query.upper()
                    else "incremental"
                )
            }
        else:
            owns_data = bool(table.has_own_data) and kind != "distributed_table"
            metadata: dict[str, Any] = {
                "engine": table.engine,
                "engineFamily": family,
                "hasOwnData": owns_data,
            }
            if owns_data and table.name in parts:
                part = parts[table.name]
                metadata["rows"] = part.rows
                metadata["size"] = {
                    "bytes": part.compressed_bytes,
                    "kind": "compressed",
                    "scope": "local",
                    "isApproximate": False,
                }
            elif owns_data and table.total_bytes is not None:
                if table.total_rows is not None:
                    metadata["rows"] = table.total_rows
                metadata["size"] = {
                    "bytes": table.total_bytes,
                    "kind": "compressed",
                    "scope": "local",
                    "isApproximate": True,
                }
            else:
                metadata["size"] = {
                    "kind": "unknown",
                    "scope": "unknown",
                    "isApproximate": False,
                }
            node["table"] = metadata
            if kind == "distributed_table":
                parsed = parse_distributed_engine(table.engine_full)
                if parsed:
                    cluster, remote = parsed
                    node["distributedTable"] = {
                        "clusterName": cluster,
                        "remoteSchema": remote.database,
                        "remoteTable": remote.table,
                    }
        nodes.append(node)
    return sorted(nodes, key=lambda item: item["id"]), ids
