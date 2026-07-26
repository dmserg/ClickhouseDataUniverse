# Product Specification

## Product name

ClickHouse Universe

## Product statement

ClickHouse Universe is a local interactive 3D visualization of ClickHouse table and view relationships. It transforms a static lineage graph into a navigable space metaphor that helps engineers understand schemas, storage scale, dependencies, ETL flows, and multi-hop data paths.
Main purpose: visualization of data cluster complexity, data lineage tracing + some fun

## Target users

Primary users:

- data engineers;
- analytics engineers;
- platform engineers;
- ClickHouse operators;
- technical architects.

The prototype should remain understandable to junior engineers. Important information must not be encoded only through color or animation.

## Primary use cases

### Explore the database landscape

The user opens the application and sees schemas as galaxies. The user can compare galaxy size, locate major tables, and understand which schemas exchange data.

### Inspect an object

The user searches for or selects a table or view and sees:

- qualified name;
- object kind;
- engine or view type;
- exact size and size semantics;
- tags and owner;
- direct upstream and downstream dependencies.

### Trace lineage

The user expands upstream or downstream lineage to a selected depth and visually follows the highlighted dependency chain.

### Find a path

The user selects a source and destination and asks the application to find a directed path.

Prototype path options:

- fewest hops;
- ETL-only;
- view-dependency-only;
- any supported edge type.

### Travel through a path

The user starts Journey mode. The camera follows the selected route and pauses or slows near intermediate objects. A cockpit-style HUD explains the current segment.

### Reduce visual noise

The user filters objects and relationships by:

- schema;
- object kind;
- engine family;
- size range;
- edge type;
- tags;
- ownership;
- isolated status.

## Out of scope

- live ClickHouse metadata extraction;
- SQL parsing;
- query execution;
- dynamic schema updates;
- collaboration;
- authentication;
- role-based access;
- web hosting;
- telemetry;
- production data governance;
- CI/CD;
- automatic deployment;
- realistic orbital mechanics;
- a complete flight simulator.

## Object metaphor

| Domain object | Visual metaphor |
|---|---|
| Schema/database | Galaxy |
| Table with owned data | Star |
| View | Small planet |
| Materialized view | Orbital transformation station |
| Distributed table | Portal-like star or gateway |
| Table dependency | Route |
| ETL transfer | Cargo route |
| Selected lineage | Highlighted route network |
| Selected path | Journey route |

## Success criteria

The prototype is successful when a user can:

- understand the global schema structure;
- identify the largest tables;
- distinguish major engine families;
- search and focus a specific object;
- view direct and multi-hop lineage;
- find and travel through a source-to-destination path;
- interact with a large mock graph without major pauses or visual overload.

## Product principles

### Clarity before spectacle

Visual effects must support understanding. A less realistic but readable visualization is preferred over a visually impressive but confusing one.

### Stable spatial memory

The same input and seed should generate the same positions. Users should be able to remember where objects are.

### Progressive disclosure

Do not show the entire graph at full detail. Reveal information as the user zooms, selects, filters, or starts a journey.

### Inspectable truth

Every visual encoding must have a tooltip, legend, or details panel that reveals the exact underlying value.

### Local-first prototype

The prototype runs entirely on the user's laptop using static mock input.
