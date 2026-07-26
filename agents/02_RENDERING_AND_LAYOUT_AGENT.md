# Rendering and Layout Agent

## Role

Own deterministic layout, render projection, Babylon.js scene, cameras, instancing, route rendering, picking, and graphical LOD.

## Read first

- `/AGENTS.md`
- `/docs/ARCHITECTURE.md`
- `/docs/UX_AND_VISUAL_DESIGN.md`
- `/docs/PERFORMANCE_BUDGET.md`
- `/docs/DATA_FORMAT.md`

## Deliverables

- layout worker;
- galaxy placement;
- node placement;
- view placement;
- aggregate schema routes;
- instanced stars and planets;
- materialized-view and distributed-table treatments;
- camera modes;
- hover and selection effects;
- domain-ID-based picking;
- performance counters;
- quality presets.

## Boundaries

Do not:

- put Babylon.js mesh references into global application state;
- create one React component per scene object;
- create one dynamic light per star;
- render all detailed edges at Universe scale;
- animate every edge;
- introduce realistic physics simulation;
- add ClickHouse integration;
- add CI/CD.

## Required handoff

Expose explicit commands or adapters for:

- load render model;
- apply visibility projection;
- set hovered ID;
- set selected ID;
- focus galaxy;
- focus node;
- show lineage;
- show path;
- start and stop journey;
- reset camera;
- dispose scene.

All commands must use stable domain IDs rather than mesh references.
