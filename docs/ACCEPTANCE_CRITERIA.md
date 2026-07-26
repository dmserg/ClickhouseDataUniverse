# Acceptance Criteria

## Application startup

- The project starts locally with one documented package-manager command.
- A production build can be created locally.
- The application opens with a loading state rather than a frozen blank canvas.
- The default small mock dataset loads without errors.

## Input validation

- Unsupported `formatVersion` is rejected.
- Duplicate schema, node, and edge IDs are rejected.
- Missing schema references are reported.
- Missing source or target node references are reported.
- Validation errors identify the affected path or entity.
- Malformed edges are not silently discarded.

## Domain graph

- Incoming and outgoing adjacency indexes are built.
- Upstream and downstream traversal support cycles without infinite loops.
- Directed pathfinding works on cyclic and disconnected graphs.
- Filtering does not mutate the source domain graph.

## Visual model

- Each schema appears as a distinct galaxy.
- Tables appear as stars.
- Table radius uses a logarithmic scale with minimum and maximum bounds.
- Exact table size remains available in the details panel.
- Engine family affects star appearance.
- Views appear smaller than stars.
- Materialized views have a distinct transformation-station appearance.
- Distributed tables have a distinct gateway or portal appearance.
- Unknown size and unknown engine have explicit visual states.

## Navigation

- The user can orbit, pan, and zoom.
- The user can enter a galaxy.
- The user can focus a node.
- The user can return to the galaxy and universe levels.
- Automatic camera transitions can be interrupted.
- The current mode is visible.
- `Escape` exits Journey mode.

## Search and filters

- Search finds objects by qualified name.
- Search can find objects by tag or owner.
- Selecting a search result focuses the object.
- Filters exist for schema, object kind, engine family, size range, and edge type.
- Reset filters restores the default view.
- The UI shows when active filters hide a selected object.

## Routes and lineage

- Inter-schema routes are aggregated in Universe mode.
- Detailed node-level routes are not all rendered at Universe scale.
- Direct upstream and downstream dependencies can be shown.
- Multi-hop lineage can be shown to a selected bounded depth.
- Edge direction is understandable.
- Edge type is available through styling, tooltip, or details.

## Pathfinding

- The user can choose a source and destination.
- The application can find a fewest-hop directed path.
- The application can restrict paths by edge type.
- The application clearly reports when no path exists.
- The selected path is highlighted and summarized.

## Journey mode

- A valid path can start Journey mode.
- The camera follows the path.
- The HUD shows current object, next object, segment, and progress.
- The user can pause and resume.
- The user can change speed.
- The user can exit immediately.
- Exiting leaves the application in a stable navigable state.

## Performance

Using the deterministic large mock dataset:

- the scene uses instancing for repeated object types;
- no dynamic light is created per star;
- labels are bounded;
- detailed edges are bounded by semantic LOD;
- layout occurs outside the main UI thread;
- Universe navigation maintains at least 30 FPS in the documented benchmark environment;
- no common filter or selection operation causes repeated multi-second UI freezes;
- performance measurements are recorded in `docs/PERFORMANCE_REPORT.md`.

## Scope compliance

The prototype contains no:

- ClickHouse connection;
- SQL execution;
- backend service;
- Docker requirement;
- cloud dependency;
- authentication;
- CI/CD pipeline;
- mandatory native Node.js module;
- live metadata update.
