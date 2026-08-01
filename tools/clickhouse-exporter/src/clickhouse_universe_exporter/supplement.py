from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .identifiers import edge_id
from .models import QualifiedName

_NODE_FIELDS = {"owner", "tags", "description"}
_EDGE_TYPES = {
    "view_dependency",
    "materialized_view_input",
    "materialized_view_target",
    "etl_transfer",
    "distributed_reference",
    "manual_dependency",
    "unknown",
}


def merge_supplement(
    path: Path | None,
    nodes: list[dict[str, Any]],
    edges: list[dict[str, Any]],
    node_ids: dict[QualifiedName, str],
) -> None:
    if path is None:
        return
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict) or set(payload) - {"nodes", "edges"}:
        raise ValueError("Supplement must be an object containing only nodes and edges")
    nodes_by_name = {node["qualifiedName"]: node for node in nodes}
    for qualified_name, metadata in payload.get("nodes", {}).items():
        if qualified_name not in nodes_by_name:
            raise ValueError(f"Supplement references unknown node {qualified_name!r}")
        if not isinstance(metadata, dict) or set(metadata) - _NODE_FIELDS:
            raise ValueError(f"Supplement metadata for {qualified_name!r} has unsupported fields")
        nodes_by_name[qualified_name].update(metadata)
    name_to_id = {name.text: identifier for name, identifier in node_ids.items()}
    for index, edge_input in enumerate(payload.get("edges", [])):
        if not isinstance(edge_input, dict):
            raise TypeError(f"Supplement edge {index} must be an object")
        source = edge_input.get("source")
        target = edge_input.get("target")
        edge_type = edge_input.get("type")
        label = edge_input.get("label", "")
        if source not in name_to_id or target not in name_to_id:
            raise ValueError(f"Supplement edge {index} references an unknown node")
        if edge_type not in _EDGE_TYPES:
            raise ValueError(f"Supplement edge {index} has unsupported type {edge_type!r}")
        source_id, target_id = name_to_id[source], name_to_id[target]
        edge: dict[str, Any] = {
            "id": edge_id(source_id, target_id, edge_type, label),
            "sourceNodeId": source_id,
            "targetNodeId": target_id,
            "type": edge_type,
        }
        for field in ("label", "metadata", "tags"):
            if field in edge_input:
                edge[field] = edge_input[field]
        edges.append(edge)
    edges[:] = sorted({edge["id"]: edge for edge in edges}.values(), key=lambda item: item["id"])
