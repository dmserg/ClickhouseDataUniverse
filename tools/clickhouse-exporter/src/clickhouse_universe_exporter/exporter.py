from __future__ import annotations

from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from time import perf_counter
from typing import Any

from . import __version__
from .clickhouse import ClickHouseError, QueryClient
from .discovery import (
    discover_databases,
    discover_part_sizes,
    discover_tables,
    probe,
)
from .lineage import build_edges
from .mapping import build_nodes, build_schemas
from .models import ExtractionReport, LineageWindow, QualifiedName, TableSnapshot
from .query_log import collect_query_log
from .supplement import merge_supplement
from .validation import validate_document


def export_universe(
    client: QueryClient,
    *,
    includes: list[str],
    excludes: list[str],
    window: LineageWindow,
    universe_id: str,
    universe_name: str,
    layout_seed: int,
    generated_at: datetime,
    supplement_path: Path | None,
    strict: bool,
    probe_result: tuple[str, str, set[str]] | None = None,
) -> tuple[dict[str, Any], ExtractionReport]:
    started = perf_counter()
    report = ExtractionReport(exporter_version=__version__)

    phase = perf_counter()
    server_version, server_timezone, columns = probe_result or probe(client)
    report.server_version = server_version
    report.server_timezone = server_timezone
    report.elapsed_seconds["probe"] = perf_counter() - phase

    phase = perf_counter()
    databases = discover_databases(client, includes, excludes)
    report.selected_databases = databases
    tables = discover_tables(client, databases, columns)
    report.elapsed_seconds["discovery"] = perf_counter() - phase

    phase = perf_counter()
    try:
        parts = discover_part_sizes(client, databases)
    except ClickHouseError:
        parts = {}
        report.warnings.append(
            "system.parts was unavailable; eligible table totals were used as approximate sizes"
        )
    report.elapsed_seconds["sizes"] = perf_counter() - phase

    schemas = build_schemas(databases)
    nodes, node_ids = build_nodes(tables, parts, report)

    phase = perf_counter()
    try:
        observations = collect_query_log(client, window)
        report.query_log = {
            "coverage": "local",
            "windowStart": _iso(window.start),
            "windowEndExclusive": _iso(window.end_exclusive),
            "timezone": window.timezone,
            "recordsRead": len(observations),
        }
    except ClickHouseError:
        observations = []
        report.query_log = {
            "coverage": "unavailable",
            "windowStart": _iso(window.start),
            "windowEndExclusive": _iso(window.end_exclusive),
            "timezone": window.timezone,
            "recordsRead": 0,
        }
        report.unresolved_reference(
            "system.query_log",
            "query log is unavailable or the exporter account lacks access",
        )
    edges = build_edges(tables, node_ids, observations, window, report)
    _apply_materialized_targets(nodes, tables, node_ids)
    merge_supplement(supplement_path, nodes, edges, node_ids)
    report.elapsed_seconds["lineage"] = perf_counter() - phase

    if strict and report.unresolved:
        first = report.unresolved[0]
        raise ValueError(
            f"Strict export found {len(report.unresolved)} unresolved references; first: "
            f"{first['object']}: {first['reason']}"
        )

    document: dict[str, Any] = {
        "formatVersion": "1.0",
        "universe": {
            "id": universe_id,
            "name": universe_name,
            "generatedAt": _iso(generated_at),
            "layoutSeed": layout_seed,
        },
        "schemas": schemas,
        "nodes": nodes,
        "edges": edges,
        "layout": None,
    }
    validate_document(document)
    report.counts = {
        "schemas": len(schemas),
        "nodes": len(nodes),
        "edges": len(edges),
        "unresolved": len(report.unresolved),
    }
    report.unknown_engines = sorted(set(report.unknown_engines))
    report.elapsed_seconds["total"] = perf_counter() - started
    return document, report


def report_document(report: ExtractionReport) -> dict[str, Any]:
    return asdict(report)


def _apply_materialized_targets(
    nodes: list[dict[str, Any]],
    tables: list[TableSnapshot],
    node_ids: dict[QualifiedName, str],
) -> None:
    nodes_by_id = {node["id"]: node for node in nodes}
    for table in tables:
        if table.engine != "MaterializedView" or not table.target_table:
            continue
        target = QualifiedName(table.target_database or table.name.database, table.target_table)
        if target in node_ids:
            nodes_by_id[node_ids[table.name]]["materializedView"]["targetNodeId"] = node_ids[target]


def _iso(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
