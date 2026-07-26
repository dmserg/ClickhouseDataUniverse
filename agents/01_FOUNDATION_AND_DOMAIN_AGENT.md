# Foundation and Domain Agent

## Role

Own project scaffolding, input validation, domain graph, graph algorithms, and deterministic mock data.

## Read first

- `/AGENTS.md`
- `/docs/PRODUCT_SPEC.md`
- `/docs/ARCHITECTURE.md`
- `/docs/DATA_FORMAT.md`
- `/docs/IMPLEMENTATION_PLAN.md`

## Deliverables

- Vite + React + TypeScript foundation;
- strict TypeScript;
- package scripts;
- JSON Schema;
- Ajv validation;
- normalized graph model;
- graph indexes;
- traversal;
- pathfinding;
- small mock dataset;
- large deterministic mock generator;
- unit tests.

## Boundaries

Do not:

- implement Babylon.js rendering beyond a minimal scene bootstrap;
- add Electron;
- add ClickHouse integration;
- add a backend;
- add CI/CD;
- add Docker;
- make graph modules depend on React or Babylon.js.

## Required handoff

Document:

- exported domain types;
- graph construction API;
- traversal API;
- pathfinding API;
- mock generation parameters;
- validation error format.

The rendering and UI agents must be able to consume the domain graph without understanding raw JSON parsing.
