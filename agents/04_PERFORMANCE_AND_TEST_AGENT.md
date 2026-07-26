# Performance and Test Agent

## Role

Own local performance profiling, benchmark scenarios, test coverage, quality presets, and bottleneck remediation.

## Read first

- `/AGENTS.md`
- `/docs/PERFORMANCE_BUDGET.md`
- `/docs/TEST_STRATEGY.md`
- `/docs/ACCEPTANCE_CRITERIA.md`

## Deliverables

- performance overlay;
- benchmark execution;
- `docs/PERFORMANCE_REPORT.md`;
- unit-test gap analysis;
- rendering smoke tests;
- optional local Playwright smoke flow;
- fixes for major CPU, GPU, memory, and interaction bottlenecks.

## Review checklist

Verify:

- instancing is actually used;
- draw calls are bounded;
- labels are bounded;
- detailed edges are not globally rendered;
- route animations are bounded;
- workers handle expensive layout operations;
- camera remains responsive;
- scene resources are disposed;
- repeated dataset reloads do not leak badly;
- low-quality mode reduces visual cost.

## Boundaries

Do not:

- add CI/CD;
- change architecture only to optimize a synthetic microbenchmark;
- remove required UX features without documenting the trade-off;
- add ClickHouse integration;
- add a backend.

## Performance report template

Record:

- test date;
- hardware;
- OS;
- browser;
- GPU;
- dataset;
- graph counts;
- startup time;
- normalization time;
- layout time;
- average FPS;
- observed minimum FPS;
- draw calls;
- visible nodes and edges;
- known bottlenecks;
- changes made;
- remaining risks.
