# UX and Visual Design

## Main layout

Use a full-window 3D canvas with a restrained UI overlay.

Recommended regions:

- top-left: application title, current mode, breadcrumbs;
- top-center: search;
- left panel: filters and legend;
- right panel: selected object details and lineage controls;
- bottom-center: navigation hints or Journey HUD;
- bottom-right: quality and debug controls in development mode.

Panels must be collapsible so the scene remains usable on a laptop display.

## Interaction modes

## Universe mode

Purpose:

- understand the global landscape;
- compare galaxies;
- inspect aggregated data flows.

Visible:

- galaxy clouds;
- galaxy labels;
- major stars only;
- aggregated schema-to-schema routes;
- selected or searched objects.

Hidden by default:

- detailed node-to-node edges;
- most labels;
- local orbit details.

Actions:

- orbit;
- pan;
- zoom;
- hover a galaxy;
- double-click a galaxy to enter Galaxy mode;
- search an object and focus it directly.

## Galaxy mode

Purpose:

- explore one schema.

Visible:

- tables;
- views;
- materialized views;
- local clusters;
- selected local relationships;
- nearby cross-schema route exits.

Actions:

- orbit around galaxy;
- select an object;
- double-click to Focus;
- return to Universe;
- filter objects.

## Focus mode

Purpose:

- inspect one object and its lineage.

Visible:

- selected object;
- direct or expanded upstream/downstream graph;
- dimmed context;
- object label and important neighbours.

Actions:

- choose lineage direction;
- choose depth;
- set as path source;
- set as path destination;
- enter Journey after a path is found;
- return to Galaxy.

## Journey mode

Purpose:

- follow a selected path as a narrative.

Visible:

- selected route;
- current object;
- next object;
- minimal nearby context;
- cockpit HUD.

Controls:

- play/pause;
- speed;
- next segment;
- previous segment;
- exit;
- optional repeat.

The user must always be able to exit immediately with `Escape`.

## Visual encoding

### Galaxies

A galaxy represents a schema.

Use:

- a soft particle cloud;
- a weak schema-specific tint;
- an elliptical boundary when selected;
- a stable label;
- one or more spiral arms or clustered arcs.

Do not encode table engine through the galaxy color. Star color already carries that meaning.

Suggested internal placement:

- large and highly connected tables near the core;
- related objects in the same arm or local cluster;
- views near their primary dependencies;
- disconnected components as satellite clusters.

### Tables as stars

Star radius uses logarithmic scaling with clamping.

Requirements:

- minimum visible size;
- maximum visual size;
- percentile-based protection against extreme outliers;
- exact size in tooltip and details panel;
- visual marker for unknown size.

Color represents engine family, not every exact engine.

Suggested initial palette categories:

- MergeTree family;
- Log family;
- Memory;
- Integration/external;
- Distributed;
- Special;
- Unknown.

The legend must show the mapping.

### Views as planets

Views are small fixed-size planets.

A normal view:

- small sphere;
- subtle ring;
- orbit or stable offset near its dependencies.

Do not continuously move views around their orbit. Stable positions are better for selection and spatial memory.

### Materialized views

Use a small orbital station or planet with an accretion ring.

Show:

- incoming input route;
- outgoing target route;
- a distinctive transformation icon or ring.

### Distributed tables

Use a small star with a portal-like halo.

Do not imply that it physically stores all underlying data unless the input explicitly says so.

### Routes

Use curved paths.

Visual distinctions:

- edge type by color and line pattern;
- direction by arrow markers or moving pulses;
- edge importance by thickness;
- selection by brightness and stronger glow.

At universe scale, show only aggregated schema-level routes.

Animate only:

- the selected path;
- selected lineage;
- a small number of major background flows.

## Selection and highlighting

On hover:

- show object name;
- show object kind;
- slightly increase glow;
- avoid opening a large panel.

On selection:

- persist highlight;
- open details panel;
- dim unrelated objects;
- show direct relationships.

On focus:

- frame object and local lineage;
- display labels only for relevant neighbours.

## Label hierarchy and progressive disclosure

Labels are part of the navigational model, not decoration:

- Universe mode prioritizes stable schema display names over individual objects;
- object names appear as their objects become legible on screen, then expand further in Galaxy mode;
- Focus mode prioritizes the selected object, hovered object, and visible lineage neighbours;
- Journey mode limits labels to the selected route;
- selected and hovered labels remain visible even when they collide;
- lower-priority labels yield when their screen rectangles overlap;
- label budgets vary by quality preset and mode, with an absolute ceiling of 50 scene labels;
- long visible names are shortened with an ellipsis; hover and the details panel retain the full qualified name.

Labels use a constant apparent screen size and do not intercept picking. This preserves readability
while orbiting or zooming and avoids creating a DOM element or React component for every node.
They use flat, muted text on the dark scene with no border, backing plate, bloom, glow, or shadow.

## Search

Search by:

- qualified name;
- short name;
- owner;
- tag.

Results should show:

- qualified name;
- schema;
- object kind;
- engine family where applicable.

Selecting a result should navigate to it, regardless of the current mode.

## Filters

Required filters:

- schema;
- object kind;
- engine family;
- minimum and maximum size;
- edge type;
- owner;
- tags;
- show or hide isolated objects;
- cross-schema only;
- selected route only.

Filter behaviour:

- apply quickly;
- preserve selection when possible;
- clearly explain when selection is hidden;
- provide `Reset filters`.

## Details panel

For a table show:

- qualified name;
- schema;
- kind;
- engine;
- engine family;
- exact size;
- size kind;
- size scope;
- approximation flag;
- rows;
- owner;
- tags;
- upstream count;
- downstream count.

For a view show:

- view type;
- dependencies;
- owner;
- tags.

For a materialized view show:

- mode;
- source relationships;
- target relationship.

## Accessibility and clarity

- Do not rely only on color.
- Use shapes, rings, line styles, and text.
- Ensure selected objects have a strong outline or halo.
- Keep text readable over the 3D scene.
- Provide a reduced-effects quality option.
- Avoid rapid flashing.
- Keep motion slow enough to understand.
