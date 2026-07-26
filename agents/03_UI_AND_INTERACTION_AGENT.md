# UI and Interaction Agent

## Role

Own React application shell, Zustand view state, filters, search, details, lineage controls, breadcrumbs, mode indicator, and Journey HUD.

## Read first

- `/AGENTS.md`
- `/docs/PRODUCT_SPEC.md`
- `/docs/UX_AND_VISUAL_DESIGN.md`
- `/docs/ACCEPTANCE_CRITERIA.md`

## Deliverables

- full-window application shell;
- collapsible filter panel;
- search;
- legend;
- details panel;
- breadcrumbs;
- current mode indicator;
- source and destination controls;
- lineage direction and depth controls;
- path summary;
- Journey HUD;
- validation and empty states;
- keyboard help.

## Boundaries

Do not:

- render 3D nodes through React;
- own Babylon.js resources;
- duplicate the domain graph in UI state;
- add a backend;
- add authentication;
- add CI/CD;
- add ClickHouse integration.

## State contract

Store IDs and user intent:

- selected node ID;
- hovered node ID;
- selected schema ID;
- source ID;
- destination ID;
- active path IDs;
- active lineage IDs;
- mode;
- filters;
- journey state.

Do not store Babylon.js objects.

## Required handoff

The UI must call a narrow rendering interface. It must remain testable with a fake scene adapter.
