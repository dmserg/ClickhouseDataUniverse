from __future__ import annotations

import argparse
import sys
from datetime import date, datetime, timezone
from pathlib import Path

from .clickhouse import ClickHouseError, connect
from .config import ConfigurationError, load_properties
from .discovery import probe
from .exporter import export_universe, report_document
from .query_log import resolve_window
from .writer import write_json_atomic


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="clickhouse-universe-exporter",
        description="Export read-only ClickHouse metadata to ClickHouse Universe format 1.0.",
    )
    parser.add_argument("--include-database", action="append", default=[])
    parser.add_argument("--exclude-database", action="append", default=[])
    parser.add_argument("--lineage-days", type=int)
    parser.add_argument("--lineage-start", type=date.fromisoformat)
    parser.add_argument("--lineage-end", type=date.fromisoformat)
    parser.add_argument(
        "--lineage-timezone",
        help="IANA timezone for date boundaries; defaults to the ClickHouse server timezone.",
    )
    parser.add_argument("--universe-id", default="clickhouse-universe")
    parser.add_argument("--universe-name", default="ClickHouse Universe")
    parser.add_argument("--layout-seed", type=int, default=42042)
    parser.add_argument("--supplement", type=Path)
    parser.add_argument(
        "--generated-at",
        type=_timestamp,
        default=None,
        help="ISO-8601 timestamp; defaults to current UTC time.",
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--strict", action="store_true", default=True)
    mode.add_argument("--allow-unresolved", action="store_true")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--report", type=Path)
    return parser


def run(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.allow_unresolved and args.report is None:
        parser.error("--allow-unresolved requires --report")
    if args.output.name in {"universe-small.json", "universe-large.json"}:
        parser.error("Refusing to overwrite a bundled mock dataset")

    client = None
    try:
        # No ClickHouse dependency is imported until this fixed home file passes validation.
        config = load_properties()
        if config.cluster:
            raise ValueError(
                "Cluster-wide extraction is not enabled in this exporter version; remove "
                "clickhouse.cluster to export the connected server's local snapshot"
            )
        client = connect(config)
        probe_result = probe(client)
        _, server_timezone, _ = probe_result
        window = resolve_window(
            timezone_name=args.lineage_timezone or server_timezone,
            days=args.lineage_days,
            start_date=args.lineage_start,
            end_date=args.lineage_end,
        )
        document, report = export_universe(
            client,
            includes=args.include_database,
            excludes=args.exclude_database,
            window=window,
            universe_id=args.universe_id,
            universe_name=args.universe_name,
            layout_seed=args.layout_seed,
            generated_at=args.generated_at or datetime.now(timezone.utc),
            supplement_path=args.supplement,
            strict=not args.allow_unresolved,
            probe_result=probe_result,
        )
        write_json_atomic(args.output, document)
        if args.report:
            write_json_atomic(args.report, report_document(report))
        print(
            f"Wrote {len(document['schemas'])} schemas, {len(document['nodes'])} nodes, "
            f"and {len(document['edges'])} edges to {args.output}"
        )
        return 0
    except (ConfigurationError, ClickHouseError, TypeError, ValueError, RuntimeError, OSError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 2
    finally:
        if client is not None:
            client.close()


def main() -> None:
    raise SystemExit(run())


def _timestamp(value: str) -> datetime:
    normalized = value[:-1] + "+00:00" if value.endswith("Z") else value
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        raise argparse.ArgumentTypeError("--generated-at must include a timezone")
    return parsed
