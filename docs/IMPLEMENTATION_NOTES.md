# Implementation Notes

Last updated: 2026-07-26

## Milestone status

### Milestone 0 — Project foundation

Status: Complete.

- Vite, React, strict TypeScript, Babylon.js, Zustand, Ajv, Vitest, ESLint, and Prettier are configured.
- The application is a full-window browser experience with a development error boundary and visible loading state.
- Local development, type-check, test, lint, mock-generation, and production-build commands are available.
- Browser verification: the Babylon canvas and React overlay render together.

### Milestone 1 — Input model and mock data

Status: Complete.

- The `1.0` input document has strict TypeScript types and an Ajv JSON Schema.
- Schema errors, duplicate IDs, missing schemas, missing edge endpoints, and materialized-view target errors include paths and entity names.
- Normalization builds incoming, outgoing, schema-membership, and edge-type indexes without a Babylon dependency.
- The deterministic generator creates 72 nodes/212 edges/6 schemas for the small dataset and 3,000 nodes/32,093 edges/50 schemas for the large dataset.
- Known paths are recorded in `public/mock/known-paths-*.json`.
- Automated verification covers valid, invalid, empty, cyclic, and disconnected graphs.

### Milestone 2 — Deterministic layout

Status: Complete.

- Galaxies use deterministic radial placement with seeded jitter.
- Nodes use stable spiral-arm placement; high-importance objects are closer to galaxy cores.
- Views and materialized views move toward dependency centroids.
- Table radius uses clamped logarithmic scaling with a 95th-percentile ceiling.
- Cross-schema edges are aggregated into serializable schema routes.
- The browser runs layout in a dedicated Web Worker.
- Large layout completes in roughly 42–97 ms in the browser benchmark session.

### Milestone 3 — Core 3D rendering

Status: Complete.

- Babylon imperatively owns all scene resources.
- Repeated stars, planets, stations, portals, and galaxy clouds use hardware instances grouped by shape and material.
- Shared emissive materials and one shared fill light replace per-star lights.
- Pointer picking maps stable domain IDs back to Zustand selection state.
- Orbit, pan, zoom, Universe, Galaxy, and Focus camera transitions are available.

### Milestone 4 — Search, filters, and details

Status: Complete.

- Search covers qualified name, short name, owner, and tags.
- Filters cover schema, object kind, engine family, size, edge type, owner, tags, and isolation.
- The details panel exposes exact size semantics, ownership, tags, rows, and degree counts.
- Breadcrumbs, mode indicator, reset controls, visible counts, collapsible panels, and a visual legend are present.
- A selected object remains selected when hidden and receives an explicit warning.

### Milestone 5 — Routes and lineage

Status: Complete.

- Universe mode renders one batched aggregate-route line system, capped at 120 logical routes.
- Galaxy mode caps local detail at 260 edges.
- Focus and Journey modes cap selected detail at 420 edges.
- Edge types have separate colors; selected paths receive full brightness.
- Cycle-safe upstream/downstream traversal supports depth 1–3.

### Milestone 6 — Pathfinding

Status: Complete.

- Deterministic breadth-first search supports any edge, ETL-only, and view-dependency-only routes.
- Source-equals-destination, cycles, disconnected components, and no-path states are covered.
- The UI exposes source/destination selection, route summaries, and path highlighting.
- The deterministic large route from `tatooine.luke_skywalker_missions` to `bespin.rey_skywalker_missions` resolves to 11 hops.

### Milestone 7 — Journey mode

Status: Complete.

- The camera interpolates along the selected route and looks toward the next object.
- The cockpit HUD exposes current object, next object, segment, progress, play/pause, speed, previous/next, and immediate exit.
- `Escape` exits Journey and restores Focus, Galaxy, or Universe state safely.
- Journey animation uses one request-animation-frame loop and animates only the selected path.

### Milestone 8 — Performance hardening

Status: Complete for the prototype.

- Low, Medium, and High quality presets are available.
- The flight recorder reports FPS, frame time, draw calls, active meshes, visible nodes, logical routes, normalization, and worker-layout duration.
- Aggregate routes and galaxies are batched; repeated object types use hardware instances.
- Semantic LOD prevents detailed edges from appearing in Universe mode.
- Results and limitations are recorded in `docs/PERFORMANCE_REPORT.md`.

### Milestone 9 — Optional Electron shell

Status: Not implemented by design.

The browser version meets the requested prototype scope. Electron adds packaging work but no validation value at this stage, so it remains optional.

## Final cleanup

- The README documents controls, architecture, datasets, and local development.
- There is no ClickHouse connection, SQL execution, backend, Docker, cloud service, authentication, CI/CD, or live metadata update.
- The only package with an install-time binary helper is Vite's required `esbuild`; this is recorded in `docs/DECISIONS.md`.
