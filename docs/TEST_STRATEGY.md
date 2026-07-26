# Test Strategy

## Goals

Testing must protect:

- graph correctness;
- deterministic layout;
- input validation;
- pathfinding;
- filter behaviour;
- stable mapping between domain IDs and rendered objects;
- critical user flows;
- performance assumptions.

No CI/CD configuration is required. Tests run locally.

## Unit tests

Use Vitest.

### Input validation

Test:

- valid small document;
- unsupported format version;
- duplicate IDs;
- missing schema;
- missing source;
- missing target;
- invalid enum values;
- unknown optional properties according to the chosen schema policy;
- empty graph.

### Domain graph

Test:

- normalized indexes;
- incoming and outgoing edges;
- schema membership;
- edge-type indexes;
- isolated nodes;
- cycles;
- disconnected components.

### Traversal

Test:

- upstream depth 1;
- downstream depth 1;
- bounded multi-hop traversal;
- duplicate prevention;
- cycle handling;
- direction correctness.

### Pathfinding

Test:

- fewest-hop path;
- no path;
- source equals destination;
- edge-type restriction;
- cycle handling;
- deterministic choice when multiple equal paths exist.

### Size scaling

Test:

- zero or missing size;
- minimum size;
- median size;
- extreme outlier;
- monotonicity;
- clamping;
- percentile behaviour.

### Layout

Test:

- determinism for same seed;
- different seed changes positions;
- no `NaN` or infinite coordinates;
- nodes remain inside expected galaxy bounds;
- schemas do not occupy identical centers;
- views remain near relevant dependencies where possible.

### Filters

Test combinations of:

- schema;
- kind;
- engine family;
- size;
- edge type;
- tags;
- owner.

## Component tests

Test React components for:

- validation-error display;
- search results;
- filter reset;
- selected object details;
- no-path state;
- Journey HUD;
- mode indicator.

Use stable domain data, not Babylon.js mocks where avoidable.

## Rendering smoke tests

Keep rendering tests limited.

Verify:

- Babylon scene initializes;
- expected instance groups are created;
- domain IDs map to pick results;
- visibility projection changes after filter updates;
- scene resources are disposed on reload.

Do not create brittle pixel-perfect tests for every visual effect.

## End-to-end smoke tests

Optional for the prototype, but recommended with Playwright after the main UI is stable.

Cover:

1. open small dataset;
2. search for a known object;
3. focus it;
4. show downstream lineage;
5. choose source and destination;
6. find a path;
7. start Journey;
8. pause;
9. exit;
10. reset to Universe.

Run locally. No CI integration is required.

## Manual visual review

Check:

- galaxy separation;
- readable scale differences;
- engine palette;
- selected-object visibility;
- labels at different zoom levels;
- route direction;
- materialized-view distinction;
- distributed-table distinction;
- low-quality preset;
- laptop touchpad navigation.

## Performance testing

Use scenarios from `PERFORMANCE_BUDGET.md`.

Record:

- hardware;
- browser version;
- GPU;
- dataset size;
- startup duration;
- layout duration;
- average FPS;
- low-percentile FPS if available;
- draw calls;
- visible nodes;
- visible edges;
- observed stalls.

Store results in `docs/PERFORMANCE_REPORT.md`.

## Test data

Mock data must be deterministic.

The large generator must accept:

- seed;
- schema count;
- node count;
- edge count;
- known-path count.

Known test paths must be explicitly recorded so pathfinding tests do not depend on random chance.
