# ClickHouse Metadata Exporter Implementation Plan

## Status

Implemented for local-server snapshots in `tools/clickhouse-exporter`. This does not add ClickHouse
connectivity to the browser application. Cluster-wide representative-replica collection remains
deferred; the CLI fails explicitly when `clickhouse.cluster` is configured.

## Goal

Build a separate, one-shot Python command-line tool that connects to an existing ClickHouse server or cluster with the official `clickhouse-connect` package, reads metadata without modifying the cluster, and writes a static ClickHouse Universe `formatVersion: "1.0"` JSON document.

The exporter must combine two lineage sources:

- declared view dependencies parsed from view definitions; and
- observed table/view-to-table lineage from successful `INSERT ... SELECT ...` statements in `system.query_log` over a user-specified time period.

The generated file must conform to [DATA_FORMAT.md](./DATA_FORMAT.md) and be loadable by the existing browser prototype. The exporter must not become a backend or a runtime dependency of the visualization.

## Non-goals

- No ClickHouse connection from React, Babylon.js, Vite, or a browser worker.
- No long-running service, API, scheduler, or metadata watcher.
- No SQL execution other than bounded, read-only metadata queries.
- No authentication UI, repository-managed credentials, Docker, cloud service, or CI/CD work.
- No claim that query-log lineage is complete or represents ETL jobs that did not execute during the selected period.
- No layout calculation in Python; emit `"layout": null`.
- No modification of the bundled mock datasets unless explicitly requested.

## Proposed package layout

Keep the exporter isolated from the TypeScript application:

```text
tools/
  clickhouse-exporter/
    pyproject.toml
    README.md
    src/
      clickhouse_universe_exporter/
        __init__.py
        __main__.py
        cli.py
        config.py
        clickhouse.py
        discovery.py
        ddl.py
        mapping.py
        lineage.py
        query_log.py
        identifiers.py
        validation.py
        writer.py
        models.py
        parsing/
          view_dependencies.py
          insert_select.py
          generated_ch_parser/
    THIRD_PARTY_NOTICES.md
    tests/
      fixtures/
      test_discovery.py
      test_ddl.py
      test_identifiers.py
      test_insert_select.py
      test_lineage.py
      test_mapping.py
      test_query_log.py
      test_validation.py
```

Use Python 3.10 or newer. Pin `clickhouse-connect` to a tested major version and add a compatible `antlr4-python3-runtime` dependency for the view parser. Prefer the standard library for the CLI and data models; add a JSON Schema validator only if the application schema is published as a shared JSON file.

## Home-directory properties contract

All ClickHouse connection and authentication settings must be read from this UTF-8 properties file:

```text
~/.clickhouse-universe-exporter.properties
```

Resolve `~` with `pathlib.Path.home()`; on Windows this is the current user's profile directory. The production CLI must use this fixed home-directory location and must not fall back to command-line arguments, environment variables, source-code constants, or a repository file.

Required file format:

```properties
# ~/.clickhouse-universe-exporter.properties
clickhouse.host=clickhouse.example.internal
clickhouse.port=8443
clickhouse.username=universe_exporter
clickhouse.password=replace-with-secret
clickhouse.secure=true
clickhouse.verify=true
clickhouse.ca_cert=C:\Users\username\.clickhouse\ca.pem
clickhouse.cluster=production
clickhouse.connect_timeout_seconds=10
clickhouse.query_timeout_seconds=60
```

Requirements:

- parse a small, documented `key=value` format without value interpolation;
- split each setting on the first `=` so passwords may contain additional `=` characters;
- treat `#` as a comment only when it is the first non-whitespace character on a line;
- require host, port, username, password, `secure`, and `verify`;
- allow `ca_cert`, cluster name, and timeouts to be optional only when their absence is semantically valid;
- reject duplicate keys, unknown keys, invalid booleans, invalid ports, and empty required values;
- resolve and validate any certificate path without printing its contents;
- never print the password or serialize any connection setting into the Universe JSON;
- never copy the real properties file into the repository, build output, test fixtures, or extraction report;
- provide a repository-safe example file containing placeholders only;
- document Windows ACLs that restrict the file to the current user and POSIX mode `0600`;
- refuse to continue when the file is missing or broadly readable, with a remediation message that does not expose its contents.

Tests must inject a temporary home directory into the configuration loader and use fake values. They must never read a developer's real home-directory properties file.

## Command-line contract

The initial command should be explicit and automation-friendly:

```powershell
python -m clickhouse_universe_exporter `
  --include-database raw `
  --include-database analytics `
  --lineage-days 30 `
  --output .\artifacts\clickhouse-universe.json
```

Planned options:

| Option | Purpose |
| --- | --- |
| `--include-database` | Repeatable allow-list. |
| `--exclude-database` | Repeatable deny-list; exclude `system` and temporary objects by default. |
| `--lineage-days N` | Read successful INSERT queries from `today - N days` at 00:00:00 through the current time. |
| `--lineage-start YYYY-MM-DD` | Explicit inclusive lineage start date. |
| `--lineage-end YYYY-MM-DD` | Explicit inclusive lineage end date; internally convert it to an exclusive boundary at the start of the following day. |
| `--lineage-timezone` | Timezone used to interpret date boundaries; default to the ClickHouse server timezone and record it in the report. |
| `--universe-id`, `--universe-name` | Output metadata. |
| `--layout-seed` | Deterministic visualization seed. |
| `--supplement` | Optional JSON/YAML-like supplement for manual owners, tags, and edges; use JSON initially to avoid another dependency. |
| `--generated-at` | Fixed timestamp for reproducible output; default to current UTC time. |
| `--strict` | Fail if any reference or semantic mapping is unresolved. This should be the default. |
| `--allow-unresolved` | Explicitly permit omissions and require a sidecar report listing each omission. |
| `--output` | Destination JSON file. Never overwrite a bundled mock by default. |
| `--report` | Optional extraction report path. |

Require exactly one time-window form: either `--lineage-days N` or both `--lineage-start` and `--lineage-end`. Reject negative day counts, incomplete explicit ranges, invalid dates, and start dates later than end dates.

Do not add CLI flags for host, port, TLS, username, password, certificate, cluster, or connection/query timeouts. Never include credentials, connection strings, DDL, or raw query text in the visualization JSON.

## Connection and safety model

Load and validate the home-directory properties before importing or constructing the ClickHouse client. Keep the resulting configuration object in memory only and make its `repr`/string representation redact the password.

Use the synchronous client because this is a short-lived metadata export:

```python
from pathlib import Path

import clickhouse_connect

config = load_properties(
    Path.home() / ".clickhouse-universe-exporter.properties"
)

client = clickhouse_connect.get_client(
    host=config.host,
    port=config.port,
    username=config.username,
    password=config.password,
    secure=config.secure,
    verify=config.verify,
    ca_cert=config.ca_cert,
)
```

Pass optional driver parameters only when present and supported by the pinned `clickhouse-connect` version. Create a small adapter around `client.query(...)` so driver result handling is isolated and easily mocked. Apply the configured conservative query timeout and read-only mode where supported. Prefix query IDs so administrators can identify exporter activity.

Before collection:

1. run `SELECT version()` and record the server version in the sidecar report;
2. query `system.columns` to detect available system-table columns;
3. verify access to required system tables, including `system.query_log`;
4. fail with a useful privilege or compatibility error before producing output.

Use a dedicated least-privilege account that can read the required metadata. Exact grants vary by ClickHouse deployment and version, so document required system-table access based on the capability probe instead of shipping a broad `GRANT`.

## Metadata sources

### `system.databases`

Use this to discover databases and apply include/exclude rules. Create one Universe schema per included ClickHouse database.

### `system.tables`

This is the primary source for objects and should be queried with an explicit column list. Depending on server capabilities, collect:

- `database`, `name`, `uuid`;
- `engine`, `engine_full`, `has_own_data`;
- `create_table_query`, `as_select`;
- `comment`, `metadata_modification_time`;
- `total_rows`, `total_bytes`, `total_bytes_uncompressed`;
- `dependencies_database`, `dependencies_table`;
- `target_database`, `target_table`;
- `is_temporary`.

Do not use `SELECT *`; system-table schemas vary across ClickHouse versions. Build the projection from the capability probe and represent unavailable values as unknown.

### `system.parts`

For MergeTree-family storage, aggregate only active parts by database and table:

```sql
SELECT
    database,
    table,
    sum(rows) AS rows,
    sum(data_compressed_bytes) AS compressed_bytes,
    sum(data_uncompressed_bytes) AS uncompressed_bytes
FROM system.parts
WHERE active
  AND database IN {databases:Array(String)}
GROUP BY database, table
```

Use parameters rather than interpolating identifiers or filter values. Treat these values as physical data visible to the queried server; do not label them `unique` or `cluster` without cluster-aware deduplication.

### `system.clusters`

When `--cluster` is supplied, validate the cluster name and obtain shard/replica topology. Prefer one representative replica per shard for unique-size aggregation. Querying every replica and summing its bytes would double-count replicated data.

Cluster-wide collection must report partial failures. It must not silently substitute a local snapshot when remote shards are unavailable.

### `system.query_log`

Use `system.query_log` as the required source for observed table/view-to-table lineage. Collect only successfully completed, initial `Insert` queries inside the selected time window:

```sql
SELECT
    event_time,
    current_database,
    query,
    normalized_query_hash,
    query_id,
    initial_query_id
FROM system.query_log
WHERE type = 'QueryFinish'
  AND query_kind = 'Insert'
  AND is_initial_query = 1
  AND event_date >= toDate({start:DateTime})
  AND event_date <= toDate({last_day:DateTime})
  AND event_time >= {start:DateTime}
  AND event_time < {end_exclusive:DateTime}
ORDER BY event_time, query_id
```

Use typed `clickhouse-connect` parameters. The `event_date` predicates support partition pruning; the `event_time` predicates enforce the exact interval. Interpret both CLI time-window forms as:

- `--lineage-days N`: `[today - N days at 00:00:00, current time]`;
- `--lineage-start` plus `--lineage-end`: from the start date at 00:00:00 through the end date at 23:59:59.999..., implemented as `[start, end + 1 day)`.

Use the selected or detected timezone consistently and record the resolved UTC boundaries in the extraction report.

`system.query_log` is local to a server. With `--cluster`, query all replicas and keep only initial queries so inserts received by different coordinators are covered without including distributed child queries. Deduplicate replicated log rows using stable execution identity, preferring `(initial_query_id, normalized_query_hash, event_time)` and retaining host information only in the sidecar report. Without `--cluster`, label query-log coverage as local.

Query text is sensitive and query logging may be disabled, sampled, truncated, expired, or missing on some nodes. The exporter must:

- report log availability, retention coverage, sampling settings when discoverable, and partial node failures;
- never copy raw SQL or query IDs into the Universe JSON;
- log only a normalized hash and redacted parse error;
- mark query-log edges as observed and approximate;
- produce no apparently complete lineage when requested dates fall outside available history.

## Mapping to the Universe document

### Stable identifiers

ClickHouse database and table names may contain spaces, punctuation, Unicode, and dots. Do not form IDs by naïvely concatenating raw names.

Generate deterministic IDs from:

- a readable normalized slug; and
- a short SHA-256 suffix of the exact UTF-8 database or qualified object name.

Example:

```text
schema.analytics-a1b2c3d4
node.analytics-orders_daily-91e28c7f
edge.view_dependency-2bd78062
```

Keep the exact source names in `name` and `qualifiedName`. Sort schemas, nodes, and edges by their stable IDs. Given the same source snapshot, options, supplement, and `--generated-at`, output should be byte-for-byte reproducible.

### Schema mapping

| Universe field | ClickHouse source |
| --- | --- |
| `id` | Deterministic database ID. |
| `name` | Exact database name. |
| `displayName` | Exact name by default; supplement may override it. |
| `description` | Supplement only unless a reliable database comment is available. |
| `owner`, `tags`, `visualGroup` | Supplement only. |

### Node-kind mapping

Apply rules in a fixed order:

| ClickHouse object | Universe kind |
| --- | --- |
| `MaterializedView` or materialized-view DDL | `materialized_view` |
| `View` | `view` |
| `LiveView` / `WindowView` | `view` with the corresponding `viewType` |
| `Distributed` | `distributed_table` |
| External integration engines such as Kafka, S3, URL, MySQL, or PostgreSQL | `external_table` |
| Known special engines such as Dictionary, Null, Join, Set, or Buffer | `special_table` |
| Other storage engines | `table` |

Keep an engine mapping table in code and include unknown engines in the extraction report. An unknown engine must not crash discovery; map it conservatively to `special_table` or `table` according to `has_own_data`, and set `engineFamily` to `Unknown`.

Suggested engine families:

- `MergeTree` for all MergeTree variants;
- `Log` for Log, TinyLog, and StripeLog;
- `Memory`;
- `Distributed`;
- `Integration` for external connector engines;
- `Special`;
- `Unknown`.

### Size and ownership semantics

Follow these rules strictly:

1. Prefer active `system.parts.data_compressed_bytes` and `rows` for MergeTree-family tables.
2. Fall back to `system.tables.total_bytes` and `total_rows` only when their semantics are appropriate.
3. A single-server observation is `scope: "local"`.
4. One representative replica per shard may be aggregated as `scope: "unique"` and marked approximate unless topology and coverage are complete.
5. A sum intentionally including every replica is `scope: "cluster"` and must be opt-in because it is not unique physical data.
6. Views and Distributed tables have `hasOwnData: false` and an unknown size unless ClickHouse explicitly reports owned storage.
7. Never copy a remote table's size onto a Distributed node.
8. Preserve unknown values rather than substituting zero.

Use `kind: "compressed"` for `data_compressed_bytes` or on-disk `total_bytes`, `kind: "uncompressed"` for uncompressed totals, and `kind: "unknown"` when no defensible value exists. Set `isApproximate` from the collection method, not from whether the number appears precise.

### Materialized views

Use `system.tables.target_database` and `target_table` when available. Fall back to a tested DDL parser only when those columns do not exist.

- Create a `materialized_view_target` edge from the materialized view to its target.
- Set `materializedView.targetNodeId` to the same target.
- Create one `materialized_view_input` edge from each source object to the materialized view.
- Use `mode: "refreshable"` only when the DDL or supported metadata explicitly identifies a refreshable view; otherwise use `incremental` for standard materialized views.
- For an implicit inner table, include it only if it is visible and selected by the database filters. Otherwise report the unresolved target.

### Normal views

Use `as_select` as the preferred SQL input for dependency extraction. Create directed `view_dependency` edges from each referenced source object to the view.

Reuse the ANTLR-based implementation from [`dmserg/clickhouse_objects_analysis`](https://github.com/dmserg/clickhouse_objects_analysis), pinned initially to commit `0e7eab950135bedfa27946c32ab89630389a9392`. Reuse and adapt only its parsing layer:

- `TableNameCollector`;
- `parse_view_tables`;
- identifier cleaning and qualification helpers;
- the checked-in `generated_ch_parser` generated from ClickHouse's ANTLR grammar.

Do not reuse its Mermaid renderer, output model, connection configuration, or command-line entry point. Move the parser behind an exporter-owned interface such as:

```python
def find_view_sources(sql: str, default_database: str) -> set[QualifiedName]:
    ...
```

The upstream implementation describes its collection as best-effort and contains heuristic fallbacks. Preserve its behavior as the baseline, then strengthen it with exporter tests and reference validation rather than replacing it with a new regular-expression parser.

Before copying or distributing source, resolve and document the upstream license: its README currently says MIT while `pyproject.toml` declares Apache-2.0. Record the selected commit, copied files, license, and local changes in `THIRD_PARTY_NOTICES.md`.

Required parser fixtures:

- quoted identifiers;
- unqualified identifiers resolved against the view database;
- joins and subqueries;
- common table expressions, which must not be mistaken for physical tables;
- table functions, which must not become internal node references;
- `UNION` branches;
- nested views and cycles.

If reliable extraction is not possible, fail in strict mode. With `--allow-unresolved`, omit only the uncertain edge and record the exact object and reason in the report.

### Observed `INSERT ... SELECT` lineage

For every successful `Insert` row collected from `system.query_log`, parse the statement and keep only the `INSERT ... SELECT` form. Ignore `INSERT ... VALUES`, `INSERT ... FORMAT`, and other inserts without a SELECT source.

Use the same pinned ClickHouse ANTLR grammar bundle as the view parser:

1. identify the destination table from the `INSERT INTO` clause;
2. isolate the SELECT subtree;
3. run the adapted table collector over that SELECT subtree;
4. resolve unqualified names using the query-log row's `current_database`;
5. classify each resolved source as a table or view from the discovered-node index;
6. create one `etl_transfer` edge from every source table or view to the INSERT destination.

Example:

```sql
INSERT INTO analytics.orders_daily
SELECT ...
FROM raw.orders AS o
INNER JOIN reference.customers AS c ON ...
```

Produces:

```text
raw.orders         --etl_transfer--> analytics.orders_daily
reference.customers --etl_transfer--> analytics.orders_daily
```

If a SELECT source is itself a view, emit `view -> INSERT target` as the observed `etl_transfer`; the separately extracted `view_dependency` edges connect the view to its underlying tables. Do not flatten or duplicate that transitive relationship.

Aggregate repeated executions into one edge per `(source, destination, etl_transfer)`. Store only non-sensitive summary metadata:

```json
{
  "lineageSource": "system.query_log",
  "observationCount": 42,
  "firstObservedAt": "2026-06-28T09:15:00Z",
  "lastObservedAt": "2026-07-28T11:20:00Z",
  "windowStart": "2026-06-28T00:00:00Z",
  "windowEnd": "2026-07-28T11:30:00Z",
  "isApproximate": true
}
```

Set the label to `observed INSERT SELECT` and add an `observed-query-log` tag. Do not emit sample SQL.

Treat `INSERT INTO FUNCTION`, dynamic table identifiers, truncated queries, parser errors, and references outside the exported database set as unresolved. Strict mode fails the export; `--allow-unresolved` records and omits each affected edge explicitly.

### Distributed tables

Parse the `Distributed(...)` engine arguments from `engine_full` with identifier-aware tokenization:

- set `distributedTable.clusterName`;
- set `remoteSchema` and `remoteTable`;
- create a `distributed_reference` edge from the Distributed node to the referenced local table when that table exists in the exported set.

Database or table arguments may be expressions rather than literals. Treat those cases as unresolved instead of guessing.

### ETL and manual relationships

`system.query_log` covers observed `INSERT ... SELECT` executions only. It cannot reveal jobs that did not run during the selected interval or jobs that write through another mechanism. Accept optional supplement entries for those relationships, keyed by exact qualified names:

```json
{
  "nodes": {
    "analytics.orders_daily": {
      "owner": "Analytics Engineering",
      "tags": ["gold", "orders"]
    }
  },
  "edges": [
    {
      "source": "raw.orders",
      "target": "analytics.orders_daily",
      "type": "etl_transfer",
      "label": "orders-daily-job"
    }
  ]
}
```

Validate supplement references after discovery. Never create placeholder nodes silently. Allow only edge types defined in `DATA_FORMAT.md`.

## Lineage resolution pipeline

Build edges only after every selected node has a stable ID:

1. discover all schemas and nodes;
2. index nodes by exact `(database, table)` tuple;
3. collect declared materialized-view targets;
4. extract materialized-view and normal-view inputs with the reused ANTLR view parser;
5. resolve Distributed references;
6. resolve the requested query-log time window;
7. collect, parse, and deduplicate successful `INSERT ... SELECT` observations;
8. create observed `etl_transfer` edges from SELECT tables/views to INSERT destinations;
9. merge explicit supplement edges;
10. deduplicate by `(sourceNodeId, targetNodeId, type, label)`;
11. assign deterministic edge IDs;
12. run full reference validation.

All edges are directed source-to-target according to the current Universe contract.

## Validation and output

Before writing:

1. validate required fields and enum values;
2. validate unique schema, node, and edge IDs;
3. validate every `schemaId`, `sourceNodeId`, `targetNodeId`, and materialized-view target;
4. reject NaN, Infinity, negative sizes, and negative row counts;
5. check that node-specific metadata matches the node kind;
6. validate the complete document with the same JSON Schema used by the browser;
7. load the generated file through the existing TypeScript validator as a compatibility test.

As a prerequisite, promote the current TypeScript-held JSON Schema to a versioned shared artifact such as:

```text
schema/universe-1.0.schema.json
```

The React import layer and Python exporter should consume the same artifact. Do not maintain two independently edited schemas.

Write UTF-8 JSON to a temporary file in the destination directory, flush it, and atomically replace the destination only after validation succeeds. On failure, leave any existing output untouched.

The optional sidecar report should include:

- exporter and server versions;
- extraction time and selected databases;
- host/shard coverage without credentials;
- resolved lineage window, timezone, query-log coverage, and observation counts;
- schema, node, and edge counts;
- size collection method and scope;
- unknown engines;
- unresolved or omitted references;
- warnings and partial failures;
- elapsed time per phase.

## Milestones

### Milestone E0 — Contract and fixtures

Deliver:

- shared `universe-1.0.schema.json`;
- Python package skeleton;
- placeholder-only properties example and repository ignore safeguards;
- typed internal snapshot and output models;
- pinned `clickhouse_objects_analysis` parser source, provenance, and resolved license;
- golden fixtures for tables, views, materialized views, Distributed tables, `INSERT ... SELECT` queries, and unusual identifiers.

Exit criteria:

- the existing TypeScript validator uses the shared schema;
- a hand-built Python fixture validates in both Python and the browser import layer;
- no ClickHouse dependency is imported by application code.

### Milestone E1 — CLI and connectivity

Deliver:

- CLI parsing and configuration validation;
- strict home-directory properties loader;
- Windows ACL and POSIX permission validation;
- rolling-day and explicit start/end lineage-window validation;
- secure credential loading;
- `clickhouse_connect.get_client(...)` adapter;
- server-version, timezone, `system.query_log`, and capability probes;
- readable timeout, TLS, authentication, and privilege errors.

Exit criteria:

- help and configuration errors work without a cluster;
- no ClickHouse connectivity setting can be supplied through source code defaults, CLI arguments, environment variables, or repository files;
- missing, malformed, duplicate-key, unknown-key, and insecure-permission properties files produce redacted, actionable errors;
- connection tests use mocks or a development endpoint configured through a temporary test home;
- no secret is printed in normal or verbose output.

### Milestone E2 — Object discovery

Deliver:

- database include/exclude handling;
- capability-aware `system.tables` query;
- schema and node snapshots;
- engine-family and node-kind mapping;
- deterministic IDs and ordering.

Exit criteria:

- the exporter handles every current Universe node kind;
- temporary and excluded objects do not appear;
- unknown engines are reported;
- repeated runs over a fixed fixture produce identical object IDs and order.

### Milestone E3 — Sizes and cluster semantics

Deliver:

- local active-part aggregation;
- fallback to table totals;
- cluster topology discovery;
- representative-replica selection;
- coverage and approximation reporting.

Exit criteria:

- replica data is not double-counted in unique mode;
- Distributed tables do not inherit remote size;
- unknown, local, unique, and cluster scopes are tested;
- partial shard coverage cannot produce an apparently complete result.

### Milestone E4 — Declared and observed lineage

Deliver:

- materialized-view target and input resolution;
- normal-view dependency extraction using the pinned `clickhouse_objects_analysis` parser;
- Distributed-engine reference parser;
- bounded `system.query_log` collection;
- ANTLR-based `INSERT ... SELECT` target/source extraction;
- repeated-observation aggregation and cluster-log deduplication;
- deterministic edge generation;
- unresolved-reference reporting.

Exit criteria:

- fixtures cover quoted names, joins, CTEs, subqueries, unions, table functions, cycles, and implicit materialized-view targets;
- both `today - N` and explicit start/end date windows have boundary tests;
- only successful, initial `INSERT ... SELECT` queries produce `etl_transfer` edges;
- SELECT tables and views point to the table in the INSERT clause;
- repeated and distributed query-log records produce one aggregate edge;
- raw query text never appears in Universe JSON or normal logs;
- strict mode fails on unresolved lineage;
- all emitted edges resolve to exported nodes.

### Milestone E5 — Supplements and final validation

Deliver:

- supplemental owner, tag, description, and edge merge;
- shared JSON Schema validation;
- domain-reference validation;
- atomic output writing;
- structured extraction report.

Exit criteria:

- invalid supplements fail with precise paths;
- an existing output survives a failed export unchanged;
- generated JSON loads in the browser with no transformation.

### Milestone E6 — Hardening and documentation

Deliver:

- unit tests with mocked `clickhouse-connect` results;
- golden end-to-end snapshot test;
- optional manual smoke test against a user-supplied read-only cluster;
- performance measurements against metadata representing at least 3,000 nodes;
- exporter README with secure home-properties setup, privileges, CLI examples, limitations, and troubleshooting.

Exit criteria:

- unit tests do not require Docker or network access;
- 3,000 nodes and 30,000 edges can be emitted within a documented time and memory budget;
- a generated large document remains usable in the existing browser prototype;
- limitations around observed query-log lineage and cluster sizing are explicit.

## Test strategy

Use mocked query results for routine tests. Maintain versioned fixtures that model old and current `system.tables` column sets.

Required test groups:

- home-directory resolution and strict properties parsing;
- missing-file, duplicate-key, unknown-key, malformed-value, and insecure-permission failures;
- proof that CLI arguments, environment variables, repository files, logs, reports, and serialized models cannot expose or override credentials;
- configuration-object and exception credential redaction;
- rolling-day, inclusive explicit-date, timezone, and daylight-saving time boundaries;
- result adapter behavior;
- capability probing;
- identifier stability and collision resistance;
- engine and object-kind mapping;
- ownership and size scope;
- inherited `clickhouse_objects_analysis` view-parser fixtures and exporter-specific regression cases;
- view, materialized-view, and Distributed DDL parsing;
- `INSERT ... SELECT` destination/source parsing;
- exclusion of `INSERT ... VALUES`, `INSERT ... FORMAT`, failed queries, and distributed child queries;
- query-log retention coverage, cluster deduplication, and observation aggregation;
- supplement merging;
- duplicate and unresolved references;
- deterministic ordering and golden JSON;
- atomic-write failure behavior;
- compatibility with the browser's shared schema and reference validator.

An integration smoke test may connect only when the developer explicitly creates the required properties file in the temporary or test user's home directory. It must skip otherwise, must not accept credentials through the test command, and must never create, alter, or drop ClickHouse objects.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| System-table columns differ by ClickHouse version. | Probe `system.columns`, select only available columns, and test multiple fixture versions. |
| The inherited view parser misses complex dependencies. | Pin the upstream commit, retain its ANTLR grammar, add regression fixtures, validate every result, and fail strict exports on parse uncertainty. |
| The referenced parser's README and package metadata name different licenses. | Resolve the license with the upstream owner before vendoring; record the result and source commit in `THIRD_PARTY_NOTICES.md`. |
| Query-log retention, sampling, or disabled logging makes observed lineage incomplete. | Measure available coverage, mark edges approximate, and report gaps instead of claiming completeness. |
| Distributed query logs duplicate an INSERT. | Keep initial successful queries only and deduplicate by execution identity and normalized query hash. |
| Query text contains sensitive SQL or literals. | Parse in memory, store only aggregate edge metadata, and redact parse errors and logs. |
| The properties file is copied into the repository or readable by other users. | Require the fixed home path, ship placeholders only, validate ACLs or mode `0600`, and fail closed on unsafe permissions. |
| Replicas inflate table sizes. | Select one representative replica per shard and report coverage and scope. |
| Metadata access is incomplete. | Fail early with named missing capabilities and produce no partial JSON by default. |
| ETL did not run during the selected query-log window or does not use `INSERT ... SELECT`. | Require supplements for missing relationships and distinguish declared, observed, and manual edges. |
| Names contain unusual characters or collide after slugging. | Add a hash of the exact UTF-8 source name to every generated ID. |
| Secrets or sensitive DDL leak into artifacts. | Redact logs, omit DDL and raw query text from output and reports, and test error paths. |
| Schema definitions drift between Python and TypeScript. | Publish one versioned JSON Schema consumed by both. |

## Definition of done

The exporter is complete when:

- it is a separate local CLI and the browser still runs without Python or ClickHouse;
- all ClickHouse connectivity settings come exclusively from `~/.clickhouse-universe-exporter.properties`;
- credentials cannot be supplied through code, CLI arguments, environment variables, or repository files, and unsafe properties-file permissions fail closed;
- it connects through `clickhouse-connect` using read-only metadata queries;
- it exports selected databases, supported object kinds, defensible size semantics, and declared view lineage;
- it accepts either a `today - N` window or explicit start/end dates and derives observed `INSERT ... SELECT` lineage from `system.query_log`;
- every table or view in the SELECT side points to the table in the INSERT clause;
- view sources are found through the pinned, attributed `clickhouse_objects_analysis` ANTLR implementation;
- all IDs and references are valid and deterministic;
- strict mode never silently drops malformed or unresolved references;
- output validates against the shared `1.0` schema and loads directly in ClickHouse Universe;
- cluster and query-log limitations are clearly reported;
- tests require neither Docker nor a live cluster.

## Reference documentation

- [ClickHouse Python integration and `clickhouse-connect` example](https://clickhouse.com/integrations/python)
- [Official `clickhouse-connect` repository](https://github.com/ClickHouse/clickhouse-connect)
- [`system.tables` reference](https://clickhouse.com/docs/reference/system-tables/tables)
- [`system.parts` reference](https://clickhouse.com/docs/reference/system-tables/parts)
- [`system.query_log` reference](https://clickhouse.com/docs/reference/system-tables/query_log)
- [`dmserg/clickhouse_objects_analysis`](https://github.com/dmserg/clickhouse_objects_analysis)
- [ClickHouse Universe static input format](./DATA_FORMAT.md)
