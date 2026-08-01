from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from .ddl import parse_distributed_engine
from .identifiers import edge_id
from .models import (
    ExtractionReport,
    LineageWindow,
    QualifiedName,
    QueryObservation,
    TableSnapshot,
)
from .parsing.sql import SqlParseError, find_view_sources, parse_insert_select


def _iso_utc(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def build_edges(
    tables: list[TableSnapshot],
    node_ids: dict[QualifiedName, str],
    observations: list[QueryObservation],
    window: LineageWindow,
    report: ExtractionReport,
) -> list[dict[str, Any]]:
    edges: dict[tuple[str, str, str, str], dict[str, Any]] = {}
    for table in tables:
        if table.engine in {"View", "LiveView", "WindowView", "MaterializedView"}:
            _add_view_edges(table, node_ids, edges, report)
        if table.engine == "Distributed":
            parsed = parse_distributed_engine(table.engine_full)
            if parsed is None:
                report.unresolved_reference(table.name.text, "dynamic or malformed Distributed arguments")
            else:
                _, remote = parsed
                _add_resolved_edge(
                    edges,
                    node_ids,
                    table.name,
                    remote,
                    "distributed_reference",
                    "",
                    report,
                )

    aggregates: dict[tuple[QualifiedName, QualifiedName], list[datetime]] = defaultdict(list)
    for observation in observations:
        try:
            parsed = parse_insert_select(observation.query, observation.current_database)
        except SqlParseError:
            report.unresolved_reference(
                f"query-hash:{observation.normalized_query_hash}",
                "INSERT query could not be parsed safely",
            )
            continue
        if parsed is None:
            continue
        if parsed.destination not in node_ids:
            report.unresolved_reference(
                f"query-hash:{observation.normalized_query_hash}",
                "INSERT destination is outside the exported node set",
            )
            continue
        for source in parsed.sources:
            if source not in node_ids:
                report.unresolved_reference(
                    f"query-hash:{observation.normalized_query_hash}",
                    f"SELECT source {source.text!r} is outside the exported node set",
                )
                continue
            aggregates[(source, parsed.destination)].append(observation.event_time)

    for (source, target), times in sorted(
        aggregates.items(), key=lambda item: (item[0][0].text, item[0][1].text)
    ):
        metadata = {
            "lineageSource": "system.query_log",
            "observationCount": len(times),
            "firstObservedAt": _iso_utc(min(times)),
            "lastObservedAt": _iso_utc(max(times)),
            "windowStart": _iso_utc(window.start),
            "windowEnd": _iso_utc(window.end_exclusive),
            "isApproximate": True,
        }
        _add_resolved_edge(
            edges,
            node_ids,
            source,
            target,
            "etl_transfer",
            "observed INSERT SELECT",
            report,
            metadata=metadata,
            tags=["observed-query-log"],
        )
    return sorted(edges.values(), key=lambda item: item["id"])


def _add_view_edges(
    table: TableSnapshot,
    node_ids: dict[QualifiedName, str],
    edges: dict[tuple[str, str, str, str], dict[str, Any]],
    report: ExtractionReport,
) -> None:
    is_materialized = table.engine == "MaterializedView"
    target: QualifiedName | None = None
    if is_materialized and table.target_table:
        target = QualifiedName(table.target_database or table.name.database, table.target_table)
        if _add_resolved_edge(
            edges,
            node_ids,
            table.name,
            target,
            "materialized_view_target",
            "",
            report,
        ):
            # targetNodeId is filled into the node later by the exporter.
            pass
    sql = table.as_select or table.create_table_query
    if not sql:
        report.unresolved_reference(table.name.text, "view has no parseable SELECT metadata")
        return
    try:
        sources = find_view_sources(sql, table.name.database)
    except SqlParseError:
        report.unresolved_reference(table.name.text, "view SELECT could not be parsed safely")
        return
    edge_type = "materialized_view_input" if is_materialized else "view_dependency"
    for source in sources:
        _add_resolved_edge(edges, node_ids, source, table.name, edge_type, "", report)


def _add_resolved_edge(
    edges: dict[tuple[str, str, str, str], dict[str, Any]],
    node_ids: dict[QualifiedName, str],
    source: QualifiedName,
    target: QualifiedName,
    edge_type: str,
    label: str,
    report: ExtractionReport,
    *,
    metadata: dict[str, Any] | None = None,
    tags: list[str] | None = None,
) -> bool:
    if source not in node_ids or target not in node_ids:
        missing = source if source not in node_ids else target
        report.unresolved_reference(
            f"{source.text} -> {target.text}", f"referenced object {missing.text!r} is not exported"
        )
        return False
    source_id, target_id = node_ids[source], node_ids[target]
    key = (source_id, target_id, edge_type, label)
    edge: dict[str, Any] = {
        "id": edge_id(source_id, target_id, edge_type, label),
        "sourceNodeId": source_id,
        "targetNodeId": target_id,
        "type": edge_type,
    }
    if label:
        edge["label"] = label
    if metadata:
        edge["metadata"] = metadata
    if tags:
        edge["tags"] = tags
    edges[key] = edge
    return True
