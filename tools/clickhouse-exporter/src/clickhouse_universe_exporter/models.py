from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass(frozen=True, order=True)
class QualifiedName:
    database: str
    table: str

    @property
    def text(self) -> str:
        return f"{self.database}.{self.table}"


@dataclass(frozen=True)
class TableSnapshot:
    name: QualifiedName
    engine: str
    engine_full: str = ""
    has_own_data: bool | None = None
    create_table_query: str = ""
    as_select: str = ""
    comment: str = ""
    total_rows: int | None = None
    total_bytes: int | None = None
    target_database: str = ""
    target_table: str = ""


@dataclass(frozen=True)
class PartSize:
    rows: int
    compressed_bytes: int
    uncompressed_bytes: int


@dataclass(frozen=True)
class QueryObservation:
    event_time: datetime
    current_database: str
    query: str
    normalized_query_hash: str
    query_id: str
    initial_query_id: str


@dataclass(frozen=True)
class LineageWindow:
    start: datetime
    end_exclusive: datetime
    timezone: str


@dataclass
class ExtractionReport:
    exporter_version: str
    server_version: str = ""
    server_timezone: str = ""
    selected_databases: list[str] = field(default_factory=list)
    unknown_engines: list[str] = field(default_factory=list)
    unresolved: list[dict[str, str]] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    query_log: dict[str, Any] = field(default_factory=dict)
    counts: dict[str, int] = field(default_factory=dict)
    elapsed_seconds: dict[str, float] = field(default_factory=dict)

    def unresolved_reference(self, obj: str, reason: str) -> None:
        self.unresolved.append({"object": obj, "reason": reason})
