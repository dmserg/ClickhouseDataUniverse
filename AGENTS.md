# AGENTS.md

## Mission

Build a local prototype called **ClickHouse Universe** that visualizes a static ClickHouse lineage graph as a navigable 3D universe.

The main goal is to validate:

- the visual metaphor;
- usability of navigation;
- lineage exploration;
- cockpit-style route travel;
- performance with approximately 3,000 nodes and 30000+ edges.

## Scope

The prototype must:

- load a versioned JSON document from a local mock file;
- visualize schemas as galaxies;
- visualize tables as stars;
- visualize views as planets;
- visualize materialized views as transformation stations;
- visualize dependencies and ETL flows as directional cargo routes;
- support search, filters, selection, focus, lineage tracing, and journey mode;
- run locally on a Windows 11 laptop;
- remain usable at the target graph size.

The prototype must not:

- connect to ClickHouse;
- execute SQL;
- discover metadata dynamically;
- contain a backend service;
- require Docker;
- require WSL;
- require cloud services;
- implement authentication or authorization;
- implement CI/CD;
- introduce native Node.js modules unless absolutely necessary;
- implement production-grade persistence.

## Required technology choices

Use:

- TypeScript;
- Vite;
- React for panels, filters, forms, HUD, and application shell;
- Babylon.js for the 3D scene;
- Zustand for lightweight UI/application state;
- Ajv with JSON Schema for input validation;
- Web Workers for graph normalization, indexes, and layout calculations;
- Vitest for unit tests.

Electron is optional until the browser prototype is stable. The application must remain runnable in a normal Chromium browser throughout the prototype.

Do not use React components for individual stars, planets, or edges. Babylon.js scene objects and GPU instance buffers must be managed imperatively by the rendering layer.

## Architectural rules

Maintain these layers:

1. **Import layer**
   - Reads the JSON document.
   - Validates it.
   - Produces useful validation errors.

2. **Domain graph**
   - Contains schemas, nodes, edges, metadata, and graph indexes.
   - Has no dependency on Babylon.js or React.

3. **Layout layer**
   - Calculates galaxy positions, node positions, orbit positions, route curves, and aggregate schema-level connections.
   - Runs outside the UI thread for large inputs.
   - Produces deterministic output for the same input and seed.

4. **Render model**
   - Converts domain and layout data into compact typed arrays and batches suitable for Babylon.js.

5. **Rendering layer**
   - Owns Babylon.js engine, scene, cameras, materials, instancing, picking, and visual LOD.
   - Does not own business state.

6. **Interaction layer**
   - Converts pointer and keyboard actions into domain-level intents such as select, focus, expand lineage, and start journey.

7. **UI layer**
   - Owns panels, filters, search, legends, details, and HUD.
   - Communicates with the scene through explicit commands and state.

Do not let Babylon.js mesh objects become the canonical representation of domain entities.

## Rendering rules

- Use hardware instancing or thin instances for large groups of similar objects.
- Use emissive materials and shader/billboard effects rather than thousands of real lights.
- Do not create one dynamic light per star.
- Do not animate every edge continuously.
- Do not render every detailed edge at universe scale.
- Do not render a DOM label for every node.
- Use semantic level of detail:
  - universe level: galaxies and aggregated inter-galaxy routes;
  - galaxy level: nodes and selected local relationships;
  - focus level: detailed lineage around selected objects;
  - journey level: only the selected route and nearby context.
- Keep coordinates in a normalized range. Do not simulate astronomical distances.
- Prefer deterministic, precomputed layout over continuous force simulation.

## UX rules

The application must support four modes:

- Universe;
- Galaxy;
- Focus;
- Journey.

Camera transitions must be smooth and interruptible.

A user must always have a visible way to:

- return to the universe;
- exit journey mode;
- clear selection;
- reset filters;
- understand the current mode;
- see the selected object name.

## Data semantics

The input distinguishes:

- table;
- view;
- materialized view;
- distributed table;
- optional external or special table types.

A materialized view is not the same as a normal view. Represent it as a transformation object with input and target relationships.

A distributed table must not inherit the full size of all underlying physical data unless the input explicitly provides that value and its scope.

Sizes must include semantics such as:

- compressed or logical;
- local, shard, cluster, or unique;
- known or unknown;
- owns data or does not own data.

## Performance constraints

Design and test for:

- approximately 3,000 nodes;
- approximately 30,000 detailed edges;
- multiple schemas;
- interactive navigation on a mid-range Windows 11 laptop.

Performance targets and measurement rules are defined in `docs/PERFORMANCE_BUDGET.md`.

## Quality rules

- Enable TypeScript strict mode.
- Avoid `any` unless justified in a comment.
- Keep modules focused and small.
- Add unit tests for graph algorithms, validation, scaling, filters, and pathfinding.
- Keep large mock datasets deterministic.
- Provide useful empty, loading, and validation-error states.
- Do not silently ignore malformed references.
- Prefer clear implementation over premature abstractions.

## Work process

Implement milestones in `docs/IMPLEMENTATION_PLAN.md` in order.

At the end of each milestone:

1. run type checking;
2. run unit tests;
3. manually verify the milestone in the browser;
4. update implementation notes;
5. record deviations in `docs/DECISIONS.md`.

Do not proceed by implementing all visual effects first. Establish a correct domain model, stable layout, and performance instrumentation early.

## Definition of prototype completion

The prototype is complete only when all required criteria in `docs/ACCEPTANCE_CRITERIA.md` are satisfied and a large deterministic mock graph can be explored without rendering all detailed edges at once.
