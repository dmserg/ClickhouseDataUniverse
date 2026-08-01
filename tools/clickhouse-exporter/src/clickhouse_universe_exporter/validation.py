from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator


def _schema_path() -> Path:
    for parent in Path(__file__).resolve().parents:
        candidate = parent / "schema" / "universe-1.0.schema.json"
        if candidate.is_file():
            return candidate
    raise RuntimeError("Could not locate shared schema/universe-1.0.schema.json")


def validate_document(document: dict[str, Any]) -> None:
    schema = json.loads(_schema_path().read_text(encoding="utf-8"))
    errors = sorted(Draft202012Validator(schema).iter_errors(document), key=lambda item: list(item.path))
    if errors:
        first = errors[0]
        path = "/" + "/".join(str(part) for part in first.path)
        raise ValueError(f"Universe schema validation failed at {path}: {first.message}")
    schema_ids = {item["id"] for item in document["schemas"]}
    node_ids = {item["id"] for item in document["nodes"]}
    if len(schema_ids) != len(document["schemas"]) or len(node_ids) != len(document["nodes"]):
        raise ValueError("Universe contains duplicate schema or node IDs")
    edge_ids: set[str] = set()
    for node in document["nodes"]:
        if node["schemaId"] not in schema_ids:
            raise ValueError(f"Node {node['id']} references unknown schema {node['schemaId']}")
        target = node.get("materializedView", {}).get("targetNodeId")
        if target is not None and target not in node_ids:
            raise ValueError(f"Node {node['id']} references unknown materialized-view target")
    for edge in document["edges"]:
        if edge["id"] in edge_ids:
            raise ValueError(f"Duplicate edge ID {edge['id']}")
        edge_ids.add(edge["id"])
        if edge["sourceNodeId"] not in node_ids or edge["targetNodeId"] not in node_ids:
            raise ValueError(f"Edge {edge['id']} references an unknown node")
    _reject_non_finite(document)


def _reject_non_finite(value: Any) -> None:
    if isinstance(value, float) and not math.isfinite(value):
        raise ValueError("Universe contains a non-finite number")
    if isinstance(value, dict):
        for child in value.values():
            _reject_non_finite(child)
    elif isinstance(value, list):
        for child in value:
            _reject_non_finite(child)
