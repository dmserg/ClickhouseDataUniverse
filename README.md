# ClickHouse Universe

ClickHouse Universe is a local, browser-first 3D explorer for a static ClickHouse lineage graph. Schemas become galaxies, data-owning tables become scaled stars, views become planets, materialized views become transformation stations, and distributed tables become portals.

The prototype is deliberately client-only. It does not connect to ClickHouse, execute SQL, run a backend, use Docker, require cloud services, authenticate users, or update metadata live.

## Start locally

Requirements: Node.js 20+ and pnpm.

```powershell
pnpm install
pnpm dev
```

Open the local URL printed by Vite. To open the large benchmark directly, append `?dataset=large` to that URL.

Other commands:

```powershell
pnpm typecheck
pnpm test
pnpm lint
pnpm build
pnpm generate:mock
```

## Controls

- Drag: orbit
- Shift + drag: pan
- Mouse wheel or touchpad scroll: zoom
- Click an object: select
- Double-click a galaxy: enter Galaxy mode
- Double-click an object or choose a search result: Focus mode
- `Escape`: exit Journey mode immediately

The breadcrumbs always provide a route back to Galaxy or Universe. Both overlay panels are collapsible.

## Main workflow

1. Search for an object or enter a galaxy.
2. Inspect exact size semantics, engine, owner, tags, and degrees.
3. Illuminate upstream, downstream, or both directions to depth 1–3.
4. Set selected objects as source and destination.
5. Calculate a fewest-hop, ETL-only, or view-dependency-only path.
6. Start Journey mode to travel the selected route.

## Architecture

```text
Local JSON
   │
   ▼
Ajv schema + reference validation
   │
   ▼
Immutable domain graph and indexes
   │
   ├───────────────► Search, filters, traversal, BFS
   │
   ▼
Layout Web Worker
   │
   ▼
Serializable layout + render projection
   │
   ▼
Babylon.js hardware instances and route batches
   ▲
   │ explicit IDs and commands
React UI + Zustand view state
```

The domain, layout, and algorithms have no Babylon or React dependency. Babylon owns scene objects imperatively; React owns panels, forms, HUD, and application state.

## Mock data

Bundled data lives under `public/mock/`.

- `universe-small.json`: 72 nodes, 212 edges, 6 schemas
- `universe-large.json`: 3,000 nodes, 32,093 edges, 50 schemas
- `known-paths-*.json`: deterministic routes for tests and Journey review

Regenerate all files with `pnpm generate:mock`. The generator uses seed `42042`, creates a heavy-tailed size distribution, covers every node and edge kind, leaves isolated components, and includes 20 known large paths.

The UI can also import a local JSON file. The format is documented in [docs/DATA_FORMAT.md](docs/DATA_FORMAT.md).

## Performance design

- hardware instances for repeated object geometry;
- one shared emissive lighting model;
- no light per star;
- one batch for aggregate Universe routes;
- no detailed edges in Universe mode;
- bounded detailed routes in Galaxy, Focus, and Journey modes;
- deterministic layout in a Web Worker;
- bounded DOM overlays;
- Low, Medium, and High quality presets;
- an optional in-app flight recorder.

See [docs/PERFORMANCE_REPORT.md](docs/PERFORMANCE_REPORT.md) for local results.

## Known limitations

- Layout is deterministic and readable, but it is not a graph-theoretic clustering optimizer.
- Aggregate Universe routes share one base style in the first prototype.
- Labels are UI overlays for relevant objects rather than world-space labels for every object.
- Quality changes that affect scene resources are fully reflected after dataset reload.
- Electron packaging is intentionally deferred.
- Performance figures depend on browser, GPU, viewport, and laptop power state.
