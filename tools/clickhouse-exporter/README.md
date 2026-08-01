# ClickHouse Universe exporter

This package is a one-shot, read-only Python 3.10+ CLI. It reads metadata from ClickHouse and
writes a static ClickHouse Universe `formatVersion: "1.0"` JSON file. It is not used by the Vite
application at runtime.

## Install

From `tools/clickhouse-exporter`:

```powershell
py -3.10 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
```

## Protect the connection file

Copy `clickhouse-universe-exporter.properties.example` to the fixed location
`~/.clickhouse-universe-exporter.properties`, replace the placeholders, and never place the real
file in the repository. Connection settings cannot be supplied through command-line arguments or
environment variables. The `clickhouse.password` key is required; an empty value is accepted for
anonymous public endpoints such as `play.clickhouse.com`.

On Windows, create the file in your profile and restrict its ACL:

```powershell
$file = Join-Path $HOME ".clickhouse-universe-exporter.properties"
icacls $file /inheritance:r
icacls $file /grant:r "$env:USERNAME:(R,W)"
```

On POSIX systems:

```sh
chmod 600 ~/.clickhouse-universe-exporter.properties
```

Playground settings corresponding to the official public example are:

```properties
clickhouse.host=play.clickhouse.com
clickhouse.port=443
clickhouse.username=explorer
clickhouse.password=
clickhouse.secure=true
clickhouse.verify=true
clickhouse.connect_timeout_seconds=10
clickhouse.query_timeout_seconds=60
```

## Export

```powershell
python -m clickhouse_universe_exporter `
  --include-database default `
  --lineage-days 30 `
  --output ..\..\artifacts\clickhouse-universe.json
```

Strict mode is the default and fails when lineage references cannot be resolved. If query-log
history is unavailable or intentionally incomplete, use `--allow-unresolved` together with a
required sidecar report:

```powershell
python -m clickhouse_universe_exporter `
  --lineage-start 2026-07-01 `
  --lineage-end 2026-07-30 `
  --allow-unresolved `
  --report ..\..\artifacts\clickhouse-universe.report.json `
  --output ..\..\artifacts\clickhouse-universe.json
```

The `system`, `INFORMATION_SCHEMA`, and `information_schema` databases are always excluded from
export, even if they are passed through `--include-database`. The exporter still reads the
read-only `system.*` metadata tables required to discover user databases and their objects.

The account needs read access to `system.databases`, `system.tables`, `system.columns`,
`system.parts`, and `system.query_log`. The exporter uses parameterized, bounded SELECT queries
with read-only settings. Query-log lineage is observed and approximate: disabled, expired,
sampled, or truncated logs cannot describe jobs that did not appear in the selected window.

This initial implementation exports a local server snapshot. It refuses a configured
`clickhouse.cluster` instead of silently presenting local data as complete cluster coverage.
