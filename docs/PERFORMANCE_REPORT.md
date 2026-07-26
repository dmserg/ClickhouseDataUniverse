# Performance Report

Benchmark date: 2026-07-26

## Environment

- Operating system: Windows 11 host
- Browser: Codex in-app Chromium browser
- Viewport: 1440 × 900
- Dataset seed: `42042`
- Workload: 3,000 nodes, 32,093 detailed edges, 50 schemas
- GPU and exact Chromium version: not exposed by the browser harness

These are local prototype measurements, not portable production guarantees.

## Results

| Scenario | Result |
|---|---|
| Startup / normalization | 11–21 ms observed |
| Worker layout | 42–97 ms observed |
| Universe frame rate | 33–58 FPS sampled across development and production previews |
| Universe frame time | approximately 16.7–25.1 ms |
| Universe draw calls | 45 |
| Universe active meshes | approximately 960, mostly hardware instances |
| Visible detailed edges in Universe | 0 |
| Visible aggregate routes | 120 logical routes in one line-system batch |
| Common filter core calculation | below the 300 ms automated-test budget |
| Focus lineage | bounded to at most 420 detailed routes |
| Known Journey path | 11 directed hops |

## Scenario review

### A — Universe orbit

The large dataset was loaded at the laptop viewport. Universe navigation sampled 56–58 FPS in the development preview and 33 FPS in the final production smoke test, remaining above the 30 FPS minimum. Galaxies use one hardware-instance batch and the 120 aggregate routes use one line-system batch. The measured draw-call counter was 45, below the 100-call objective.

### B — Galaxy exploration

Search-to-focus and camera framing were exercised on the large dataset. Galaxy routes are bounded to 260 local edges, and the object renderer preserves hardware-instance groups rather than rebuilding domain objects.

### C — Lineage expansion

Direct lineage and bounded traversal were exercised in the browser. Automated tests cover depth, cycles, duplicate prevention, and direction. Focus rendering caps the projected route set at 420.

### D — Filtering

Combined schema, engine-family, and size filters were exercised against the large graph. The browser stayed responsive and updated visible counts. The core filter benchmark is protected by a test with a 300 ms ceiling.

### E — Journey

The deterministic benchmark contains 20 isolated known routes of 11 hops each. The first route was path-found in the browser. Journey controls and exit behavior are covered by component and state tests; only the selected path is rendered.

## Bottlenecks found and corrected

1. Initial aggregate routes and galaxy meshes produced 267 Universe draw calls. Batching them reduced the observed count to 45.
2. Returning a fresh composite Zustand selector snapshot caused a React update loop. The scene projection now uses a shallow stable selector and memoized derived sets.
3. Journey progress originally restarted an effect on every frame. It now uses one animation loop and reads current state without remounting the effect.

## Known measurement limitations

- GPU utilization and low-percentile FPS are not exposed by the local browser harness.
- The FPS figure is an observed sample rather than a laboratory-grade 30-second trace.
- Browser automation latency is not used as filter-compute latency because it includes cross-process control overhead.
- Quality presets currently tune glow complexity and semantic limits; they do not change every mesh tessellation after a scene is already created.
