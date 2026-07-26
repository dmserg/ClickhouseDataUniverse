# Architecture

## Architectural style

Use a local, browser-first, client-only architecture.

The application consists of:

- a React application shell;
- a Babylon.js rendering subsystem;
- a domain graph subsystem;
- layout and graph workers;
- local JSON input;
- local-only state.

No backend is required.

## Runtime overview

```text
Local JSON
   |
   v
Importer and JSON Schema validation
   |
   v
Normalized domain graph
   |
   +-------------------+
   |                   |
   v                   v
Graph indexes       Layout worker
   |                   |
   +---------+---------+
             |
             v
        Render model
             |
             v
       Babylon.js scene
             ^
             |
 React UI <-> App state <-> Interaction controller
```

## Module boundaries

### `src/import`

Responsibilities:

- load local bundled mock files;
- optionally load a user-selected JSON file;
- validate the document;
- report validation and reference errors;
- convert raw input to normalized domain entities.

It must not:

- calculate 3D positions;
- create UI components;
- create Babylon.js objects.

### `src/domain`

Responsibilities:

- domain types;
- normalized graph storage;
- adjacency indexes;
- schema membership indexes;
- edge-type indexes;
- search indexes;
- upstream and downstream traversal;
- pathfinding;
- filter predicates.

Suggested normalized representation:

```text
schemasById
nodesById
edgesById
outgoingEdgeIdsByNodeId
incomingEdgeIdsByNodeId
nodeIdsBySchemaId
edgeIdsByType
```

### `src/layout`

Responsibilities:

- calculate schema-level graph;
- place galaxies;
- calculate galaxy radius;
- place nodes inside galaxies;
- define view orbits;
- generate route control points;
- produce aggregated inter-galaxy connections;
- calculate bounds and LOD metadata.

The output must be serializable and independent of Babylon.js.

### `src/workers`

Use workers for:

- validation of very large documents if needed;
- graph normalization;
- graph indexes;
- deterministic layout;
- route-geometry preparation.

Do not move the Babylon.js renderer into a worker during the first prototype unless profiling proves the main thread is the bottleneck.

### `src/rendering`

Responsibilities:

- Babylon engine and scene lifecycle;
- camera modes;
- star, planet, station, and portal rendering;
- instancing and thin instances;
- route rendering;
- glow, particles, and simple galaxy fog;
- picking;
- semantic and graphical LOD;
- render-loop instrumentation.

Suggested internal services:

- `SceneController`;
- `CameraController`;
- `GalaxyRenderer`;
- `NodeRenderer`;
- `RouteRenderer`;
- `SelectionRenderer`;
- `LabelRenderer`;
- `QualityController`;
- `PickingController`.

### `src/interaction`

Responsibilities:

- translate pointer, wheel, keyboard, and touchpad input;
- hover and selection;
- double-click focus;
- source and destination selection;
- mode transitions;
- camera interruption;
- focus and reset commands.

### `src/journey`

Responsibilities:

- convert a graph path to a camera route;
- sample route splines;
- control speed and pauses;
- produce current segment and progress;
- expose HUD state;
- safely exit and restore the prior camera mode.

### `src/ui`

Responsibilities:

- application shell;
- filters;
- search;
- object details;
- legend;
- breadcrumbs;
- mode indicator;
- lineage controls;
- journey HUD;
- validation errors;
- performance debug panel.

React must not render one component per 3D node.

## State ownership

### Domain state

Contains loaded graph and immutable metadata.

### View state

Contains:

- filters;
- selected node;
- hovered node;
- selected source;
- selected destination;
- active lineage;
- active path;
- current mode;
- panel visibility;
- quality preset.

### Scene state

Contains Babylon.js resources and must stay inside rendering services.

Store stable entity IDs in application state. Do not store Babylon.js mesh references in Zustand.

## Rendering data flow

```text
Domain graph
  + layout result
  + active filters
  + active selection
        |
        v
Render projection
        |
        v
Typed arrays and batches
        |
        v
Babylon.js instances and route buffers
```

When filters change, prefer updating visibility masks or compact instance buffers. Avoid creating and destroying thousands of scene objects individually.

## Camera modes

### Universe camera

Orbit around the complete galaxy set.

### Galaxy camera

Orbit around a selected galaxy's bounds.

### Focus camera

Smoothly approaches a selected object and frames its local lineage.

### Journey camera

Follows a precomputed spline and exposes progress to the HUD.

Camera transitions must be cancellable. User input during an automatic transition should stop or take control.

## Electron strategy

Do not make Electron a prerequisite for early milestones.

Recommended sequence:

1. develop and profile in Chromium via Vite;
2. stabilize rendering, input, and data loading;
3. add Electron as a thin shell;
4. keep the same browser entry point working.

Electron must not contain business logic that cannot run in the browser version.

## Error handling

Display explicit user-facing errors for:

- invalid format version;
- JSON Schema violations;
- duplicate IDs;
- missing schema references;
- missing node references;
- unsupported enum values;
- impossible journey path;
- empty input;
- worker failure.

Do not silently drop invalid edges.
