# Static Input Data Format

## Decision

Use a versioned JSON document as the canonical input format.

Mermaid may be added later as a convenience importer, but it must not be the internal or canonical model. Mermaid does not naturally express size semantics, engine metadata, ownership, lineage types, cluster scope, and layout hints.

## Top-level structure

```json
{
  "formatVersion": "1.0",
  "universe": {
    "id": "demo-universe",
    "name": "Demo ClickHouse Universe",
    "description": "Deterministic mock lineage graph",
    "generatedAt": "2026-07-26T00:00:00Z",
    "layoutSeed": 42042
  },
  "schemas": [],
  "nodes": [],
  "edges": [],
  "layout": null
}
```

## Schemas

```json
{
  "id": "schema.analytics",
  "name": "analytics",
  "displayName": "Analytics",
  "description": "Curated analytical models",
  "tags": ["analytics"],
  "owner": "Analytics Engineering"
}
```

Required fields:

- `id`;
- `name`.

Optional fields:

- `displayName`;
- `description`;
- `tags`;
- `owner`;
- `visualGroup`.

## Nodes

Common shape:

```json
{
  "id": "node.analytics.orders_daily",
  "schemaId": "schema.analytics",
  "name": "orders_daily",
  "qualifiedName": "analytics.orders_daily",
  "kind": "table",
  "description": "Daily order facts",
  "tags": ["orders", "gold"],
  "owner": "Analytics Engineering",
  "metrics": {},
  "table": {}
}
```

### Node kinds

Use one of:

- `table`;
- `view`;
- `materialized_view`;
- `distributed_table`;
- `external_table`;
- `special_table`.

### Table metadata

```json
{
  "table": {
    "engine": "ReplicatedMergeTree",
    "engineFamily": "MergeTree",
    "hasOwnData": true,
    "size": {
      "bytes": 482193847562,
      "kind": "compressed",
      "scope": "unique",
      "isApproximate": false
    },
    "rows": 8934215670
  }
}
```

`size.kind`:

- `compressed`;
- `uncompressed`;
- `logical`;
- `unknown`.

`size.scope`:

- `local`;
- `shard`;
- `cluster`;
- `unique`;
- `unknown`.

### View metadata

```json
{
  "view": {
    "viewType": "normal"
  }
}
```

`viewType`:

- `normal`;
- `live`;
- `window`;
- `other`.

### Materialized view metadata

```json
{
  "materializedView": {
    "mode": "incremental",
    "targetNodeId": "node.analytics.orders_daily"
  }
}
```

`mode`:

- `incremental`;
- `refreshable`;
- `other`.

### Distributed table metadata

```json
{
  "distributedTable": {
    "clusterName": "analytics_cluster",
    "remoteSchema": "analytics_local",
    "remoteTable": "orders_daily_local"
  }
}
```

A distributed table normally has `hasOwnData: false`. Do not assign the total size of remote data unless the data document intentionally describes that scope.

## Edges

```json
{
  "id": "edge.raw_orders_to_orders_daily",
  "sourceNodeId": "node.raw.orders",
  "targetNodeId": "node.analytics.orders_daily",
  "type": "etl_transfer",
  "label": "orders-daily-job",
  "metadata": {
    "jobName": "orders-daily-job",
    "schedule": "0 * * * *",
    "volumeBytesPerDay": 21474836480,
    "latencySeconds": 900
  },
  "tags": ["hourly"]
}
```

### Edge types

Use one of:

- `view_dependency`;
- `materialized_view_input`;
- `materialized_view_target`;
- `etl_transfer`;
- `distributed_reference`;
- `manual_dependency`;
- `unknown`.

All edges are directed from source to target.

## Optional layout section

The prototype normally calculates layout. A document may optionally provide fixed positions:

```json
{
  "layout": {
    "algorithmVersion": "prototype-1",
    "galaxies": {
      "schema.analytics": {
        "position": [120, 20, -80]
      }
    },
    "nodes": {
      "node.analytics.orders_daily": {
        "position": [132, 24, -71]
      }
    }
  }
}
```

Rules:

- input positions are hints or fixed coordinates;
- missing positions are calculated;
- the application must still validate references;
- generated layout should be deterministic for the same seed.

## Small complete example

```json
{
  "formatVersion": "1.0",
  "universe": {
    "id": "demo",
    "name": "Small Demo",
    "layoutSeed": 42
  },
  "schemas": [
    {
      "id": "schema.raw",
      "name": "raw",
      "displayName": "Raw"
    },
    {
      "id": "schema.analytics",
      "name": "analytics",
      "displayName": "Analytics"
    }
  ],
  "nodes": [
    {
      "id": "node.raw.orders",
      "schemaId": "schema.raw",
      "name": "orders",
      "qualifiedName": "raw.orders",
      "kind": "table",
      "table": {
        "engine": "ReplicatedMergeTree",
        "engineFamily": "MergeTree",
        "hasOwnData": true,
        "size": {
          "bytes": 1099511627776,
          "kind": "compressed",
          "scope": "unique",
          "isApproximate": false
        },
        "rows": 12500000000
      }
    },
    {
      "id": "node.analytics.orders_daily",
      "schemaId": "schema.analytics",
      "name": "orders_daily",
      "qualifiedName": "analytics.orders_daily",
      "kind": "table",
      "table": {
        "engine": "SummingMergeTree",
        "engineFamily": "MergeTree",
        "hasOwnData": true,
        "size": {
          "bytes": 8589934592,
          "kind": "compressed",
          "scope": "unique",
          "isApproximate": false
        },
        "rows": 250000000
      }
    },
    {
      "id": "node.analytics.orders_view",
      "schemaId": "schema.analytics",
      "name": "orders_view",
      "qualifiedName": "analytics.orders_view",
      "kind": "view",
      "view": {
        "viewType": "normal"
      }
    }
  ],
  "edges": [
    {
      "id": "edge.orders_etl",
      "sourceNodeId": "node.raw.orders",
      "targetNodeId": "node.analytics.orders_daily",
      "type": "etl_transfer",
      "label": "orders-hourly"
    },
    {
      "id": "edge.orders_view_dependency",
      "sourceNodeId": "node.analytics.orders_daily",
      "targetNodeId": "node.analytics.orders_view",
      "type": "view_dependency"
    }
  ],
  "layout": null
}
```

## Mock dataset requirements

Create two deterministic bundled datasets.

### Small dataset

Purpose:

- development;
- visual review;
- debugging.

Target:

- 4 to 6 schemas;
- 50 to 100 nodes;
- 100 to 300 edges;
- examples of every supported node and edge kind.

### Large dataset

Purpose:

- performance validation.

Target:

- approximately 3,000 nodes;
- approximately 30,000 edges;
- at least 12 schemas;
- a heavy-tailed table-size distribution;
- multiple disconnected components;
- several cross-schema hubs;
- at least 20 known source-to-destination paths;
- a fixed generation seed.

Do not hand-write the large dataset. Generate it deterministically with a local script and commit the resulting JSON or generate it during development startup.
