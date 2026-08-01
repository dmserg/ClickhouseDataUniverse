from __future__ import annotations

import hashlib
import re
import unicodedata

from .models import QualifiedName


def _slug(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii").casefold()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_value).strip("-")
    return slug[:48] or "object"


def _suffix(exact: str) -> str:
    return hashlib.sha256(exact.encode("utf-8")).hexdigest()[:10]


def schema_id(database: str) -> str:
    return f"schema.{_slug(database)}-{_suffix(database)}"


def node_id(name: QualifiedName) -> str:
    exact = f"{name.database}\x1f{name.table}"
    return f"node.{_slug(name.database)}-{_slug(name.table)}-{_suffix(exact)}"


def edge_id(source: str, target: str, edge_type: str, label: str = "") -> str:
    exact = f"{source}\x1f{target}\x1f{edge_type}\x1f{label}"
    return f"edge.{_slug(edge_type)}-{_suffix(exact)}"
