# Performance Budget

## Target workload

The prototype must be designed for:

- approximately 3,000 nodes;
- approximately 30,000 detailed edges;
- at least 50 schemas;
- a heavy-tailed distribution of table sizes;
- local execution on a mid-range Windows 11 laptop.

The detailed graph must not be fully rendered at all times.

## Performance objectives

These are prototype targets, not contractual production SLAs.

### Startup

For the large deterministic mock dataset:

- input load, validation, normalization, indexing, and initial layout should complete within 5 seconds on a reasonable development laptop;
- the UI must show a progress or loading state;
- the main thread should not freeze for multi-second intervals.

### Interaction

Target:

- hover feedback within 100 ms;
- selection feedback within 150 ms;
- filter update within 300 ms for common filters;
- camera controls remain responsive during background calculations.

### Frame rate

Target:

- 30 FPS minimum during normal universe navigation on the large dataset;
- 45 FPS or better is preferred on common development hardware;
- no repeated multi-frame stalls while orbiting;
- Journey mode should remain visually smooth.

Do not sacrifice correctness or basic usability only to reach a higher average FPS.

## Required techniques

### Semantic level of detail

Universe:

- galaxies;
- major stars;
- aggregated schema routes.

Galaxy:

- nodes in the selected schema;
- limited local and cross-schema routes.

Focus:

- selected object;
- bounded upstream/downstream subgraph.

Journey:

- selected path;
- small nearby context.

### Instancing

Use thin instances or hardware instances for:

- stars;
- planets;
- stations;
- route markers;
- repeated decorative particles.

Group instances by geometry and material.

### Draw-call control

Set an initial design objective of:

- fewer than 100 draw calls in Universe mode;
- fewer than 250 draw calls in Galaxy or Focus mode under normal conditions.

These are guidance values. Record actual results.

### Labels

Do not render all labels.

Render labels for:

- selected object;
- hovered object;
- search results;
- major visible objects;
- currently relevant lineage nodes.

### Lighting

Use:

- emissive materials;
- bloom;
- billboard coronas;
- limited shared scene lights.

Do not create a point light per star.

### Routes

- aggregate inter-schema routes at universe scale;
- batch route geometry where practical;
- animate only selected or major routes;
- avoid a separate animation timer per edge.

### Workers

Move expensive graph and layout operations off the main thread.

Use transferable typed arrays when large layout or render buffers are passed between worker and UI.

### Deterministic layout

Do not run an unconstrained live force simulation every frame.

Calculate layout once per document or seed and reuse it.

## Quality presets

Provide at least:

### Low

- reduced particles;
- reduced bloom;
- fewer labels;
- simpler star geometry;
- lower route animation count.

### Medium

- default balanced mode.

### High

- increased particles and post-processing;
- more detailed nearby objects;
- still respects semantic LOD.

The user may override the preset.

## Instrumentation

Add a development performance overlay that can show:

- FPS;
- frame time;
- draw calls;
- active meshes or instances;
- visible nodes;
- visible detailed edges;
- visible aggregate edges;
- worker layout duration;
- graph normalization duration;
- approximate GPU or scene resource counts where available.

## Benchmark scenarios

### Scenario A: Universe orbit

- large dataset loaded;
- no selection;
- all schemas enabled;
- orbit for 30 seconds.

### Scenario B: Galaxy exploration

- enter the largest galaxy;
- enable local edges;
- rotate and zoom.

### Scenario C: Lineage expansion

- select a high-degree node;
- show three upstream and downstream hops;
- inspect responsiveness.

### Scenario D: Filtering

- filter by two schemas, one engine family, and a size range;
- reset filters;
- repeat.

### Scenario E: Journey

- travel through a route of at least 10 hops;
- change speed;
- pause and resume.
- make it entertaining

Record results in a local `docs/PERFORMANCE_REPORT.md`. No CI integration is required.
