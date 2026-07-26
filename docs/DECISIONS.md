# Architecture Decisions

Use this file as a lightweight architecture decision log.

Do not delete accepted decisions without recording a replacement.

---

## ADR-001 — Canonical input is versioned JSON

**Status:** Accepted

**Decision:** Use a versioned JSON document as the canonical input.

**Reasoning:**

- supports rich metadata;
- easy to validate;
- easy to generate;
- easy to load locally;
- independent from rendering;
- more expressive than Mermaid.

**Consequences:**

- define JSON Schema;
- maintain format versions;

---

## ADR-002 — Browser-first, Electron later

**Status:** Accepted

**Decision:** Develop and profile the prototype in a Chromium browser before adding Electron.

**Reasoning:**

- faster development;
- simpler debugging;
- avoids desktop packaging work before product validation;
- preserves portability.

**Consequences:**

- browser entry point remains supported;
- Electron must remain a thin shell.

---

## ADR-003 — Babylon.js owns 3D objects

**Status:** Accepted

**Decision:** Manage 3D objects imperatively in Babylon.js. React manages UI, not individual stars or edges.

**Reasoning:**

- thousands of React components would add avoidable overhead;
- Babylon.js is better suited to scene lifecycle and instancing;
- clearer separation of domain and rendering.

---

## ADR-004 — Semantic LOD is mandatory

**Status:** Accepted

**Decision:** Use different graph detail at Universe, Galaxy, Focus, and Journey levels.

**Reasoning:**

- the edge count is a larger risk than the node count;
- rendering the full graph creates visual clutter;
- progressive disclosure improves understanding and performance.

---

## ADR-005 — Deterministic static layout

**Status:** Accepted

**Decision:** Calculate layout once from the document and seed. Do not run a live force simulation continuously.

**Reasoning:**

- static input does not require live rearrangement;
- deterministic placement supports spatial memory;
- lower CPU usage;
- easier testing.

---

## ADR-006 — No physical light per star

**Status:** Accepted

**Decision:** Use emissive materials, billboards, glow, and bloom rather than one light source per star.

**Reasoning:**

- thousands of dynamic lights are unnecessary and expensive;
- visual brightness does not require real illumination.

---

## ADR-007 — Materialized views are transformation objects

**Status:** Accepted

**Decision:** Render materialized views differently from normal views and model source and target relationships explicitly. They're randered as stars where size matches Materialized View Size.

**Reasoning:**

- materialized views have data-flow semantics;
- treating them as ordinary planets hides important architecture.

---

## ADR-008 — Prototype has no ClickHouse integration

**Status:** Accepted

**Decision:** The prototype loads static mock data only.

**Reasoning:**

- current goal is to validate architecture, UX, and performance;
- metadata extraction and SQL parsing are separate projects.

---

## ADR-009 — Hardware instances grouped by visual family

**Status:** Accepted

**Decision:** Group repeated Babylon geometry by object kind and engine family, then create hardware instances with stable domain IDs.

**Reasoning:**

- preserves pickable object identity;
- reduces geometry allocation and draw calls;
- keeps React out of per-object rendering;
- supports the target 3,000-node workload.

---

## ADR-010 — Aggregate routes use one line-system batch

**Status:** Accepted

**Decision:** Render the top 120 logical inter-schema routes as one Babylon line system in Universe mode.

**Reasoning:**

- reduced observed Universe draw calls from 267 to 45;
- Universe mode does not need per-edge picking;
- logical route counts remain available in instrumentation.

**Consequence:** Aggregate routes share one base color in the first prototype; detailed route types remain color-coded in Galaxy, Focus, and Journey modes.

---

## ADR-011 — Electron remains deferred

**Status:** Accepted

**Decision:** Do not add the optional Electron milestone to this prototype.

**Reasoning:**

- the Chromium browser version is runnable and stable;
- Electron would not improve validation of the metaphor, graph algorithms, or semantic LOD;
- avoiding a desktop shell keeps the current scope smaller.

---

## ADR-012 — Permit Vite's required esbuild helper

**Status:** Accepted

**Decision:** Permit the `esbuild` install script through pnpm's explicit `allowBuilds` policy.

**Reasoning:**

- Vite requires esbuild for its normal development and build pipeline;
- the project introduces no application-level native Node module;
- the permission is narrowly scoped to the declared build helper.

---

## New decision template

### ADR-XXX — Title

**Status:** Proposed | Accepted | Rejected | Superseded

**Context:**

Describe the problem.

**Decision:**

Describe the chosen approach.

**Reasoning:**

Explain why.

**Consequences:**

List important trade-offs.
