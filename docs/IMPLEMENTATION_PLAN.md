# Implementation Plan

Implement milestones in order. Keep the application runnable after every milestone.

## Milestone 0 — Project foundation

Deliver:

- Vite + React + TypeScript project;
- Babylon.js dependency;
- Zustand;
- Ajv;
- Vitest;
- strict TypeScript configuration;
- basic full-window application shell;
- development error boundary;
- linting and formatting configuration;
- local commands for development, build, test, and type checking.

Do not add Electron yet unless the browser prototype is already stable.

Exit criteria:

- blank Babylon scene renders;
- React overlay renders;
- local development server works;
- unit test command works;
- production build works.

## Milestone 1 — Input model and mock data

Deliver:

- TypeScript types for the input document;
- JSON Schema for version `1.0`;
- Ajv validation;
- reference validation;
- normalized graph structure;
- adjacency indexes;
- deterministic small dataset;
- deterministic large dataset generator;
- tests for valid and invalid input.

Exit criteria:

- small and large datasets load;
- invalid references produce readable errors;
- graph traversal tests pass;
- no Babylon.js dependency exists in domain modules.

## Milestone 2 — Deterministic layout

Deliver:

- schema-level graph;
- deterministic galaxy placement;
- galaxy radius calculation;
- deterministic node placement inside galaxies;
- stable view placement;
- basic route control points;
- layout worker;
- layout timing instrumentation;
- unit tests for determinism and valid numeric output.

Initial layout approach:

1. calculate weighted schema graph;
2. place schemas with a deterministic force or radial algorithm executed once;
3. assign each schema a local coordinate system;
4. place important tables near the center;
5. distribute remaining objects into spiral arms or clustered arcs;
6. place views near dependency centroids;
7. create satellite clusters for disconnected components.

Exit criteria:

- same input and seed produce the same positions;
- no invalid coordinates;
- large layout runs in a worker;
- UI remains responsive during layout.

## Milestone 3 — Core 3D rendering

Deliver:

- galaxy particle or billboard clouds;
- instanced table stars;
- instanced view planets;
- materialized-view stations;
- distributed-table portal treatment;
- logarithmic size scaling;
- engine-family palette;
- selection and hover highlighting;
- basic universe and galaxy camera modes;
- picking by stable domain ID.

Exit criteria:

- small dataset is visually understandable;
- large dataset renders with instancing;
- no real light per star;
- no React component per 3D object;
- selected object maps correctly to the details panel.

## Milestone 4 — Search, filters, and details

Deliver:

- search by name, qualified name, tag, and owner;
- filter panel;
- legend;
- object details panel;
- breadcrumbs;
- mode indicator;
- reset controls;
- visible-count statistics.

Filters:

- schema;
- object kind;
- engine family;
- size range;
- edge type;
- owner;
- tags;
- isolated status.

Exit criteria:

- common filters apply within the performance budget;
- hidden selection is handled explicitly;
- search can navigate directly to an object;
- the user can always return to Universe mode.

## Milestone 5 — Routes and lineage

Deliver:

- aggregated schema-to-schema routes in Universe mode;
- detailed local routes in Galaxy and Focus modes;
- direction indicators;
- edge-type visual styles;
- upstream/downstream traversal;
- depth controls;
- selected-lineage highlighting;
- bounded label display.

Exit criteria:

- detailed edges are not all visible in Universe mode;
- lineage depth 1 to 3 is usable;
- high-degree nodes do not freeze the UI;
- route selection is visually clear.

## Milestone 6 — Pathfinding

Deliver:

- choose source;
- choose destination;
- find directed path;
- fewest-hops mode;
- ETL-only mode;
- view-dependency-only mode;
- no-path state;
- path summary list;
- route highlighting.

Use breadth-first search for fewest hops. Keep the pathfinding implementation independent from rendering.

Exit criteria:

- known paths in the mock dataset are found;
- invalid or impossible paths are reported clearly;
- path tests cover cycles and disconnected components.

## Milestone 7 — Journey mode

Deliver:

- path-to-spline conversion;
- Journey camera;
- smooth segment transitions;
- cockpit-style 2D HUD;
- play/pause;
- speed control;
- next and previous segment;
- immediate exit with `Escape`;
- restoration of a safe camera state after exit.

Avoid building a full 3D cockpit model in the prototype.

Exit criteria:

- a path of at least 10 hops can be travelled;
- current and next object are shown;
- the user can pause, resume, and exit safely;
- frame rate remains within the performance budget.

## Milestone 8 — Performance hardening

Deliver:

- quality presets;
- performance overlay;
- draw-call and visibility counters;
- route and label limits;
- profiling of large dataset scenarios;
- `docs/PERFORMANCE_REPORT.md`;
- fixes for the most important bottlenecks.

Exit criteria:

- benchmark scenarios are executed;
- results are documented;
- semantic LOD is verified;
- common interactions remain responsive.

## Milestone 9 — Optional Electron shell

Only start after the browser version is stable.

Deliver:

- thin Electron shell;
- local file-open workflow;
- packaged Windows development build;
- no backend;
- no native modules unless justified;
- browser version remains usable.

CI/CD and code signing are out of scope.

## Final cleanup

Deliver:

- concise root README;
- keyboard and mouse controls;
- architecture diagram;
- known limitations;
- mock-data instructions;
- local development instructions;
- no dead experimental modules;
- no hidden dependency on ClickHouse.
