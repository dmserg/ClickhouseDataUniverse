import type { DomainGraph, FilterState, NodeInput } from "./types";

export const DEFAULT_FILTERS: FilterState = {
  schemaIds: [],
  kinds: [],
  engineFamilies: [],
  minBytes: null,
  maxBytes: null,
  edgeTypes: [],
  owners: [],
  tags: [],
  hideIsolated: false
};

export function nodeMatchesFilters(
  node: NodeInput,
  graph: DomainGraph,
  filters: FilterState
): boolean {
  const bytes = node.table?.size?.bytes;
  return (
    (filters.schemaIds.length === 0 || filters.schemaIds.includes(node.schemaId)) &&
    (filters.kinds.length === 0 || filters.kinds.includes(node.kind)) &&
    (filters.engineFamilies.length === 0 ||
      filters.engineFamilies.includes(node.table?.engineFamily ?? "Unknown")) &&
    (filters.minBytes === null || (bytes !== undefined && bytes >= filters.minBytes)) &&
    (filters.maxBytes === null || (bytes !== undefined && bytes <= filters.maxBytes)) &&
    (filters.owners.length === 0 || filters.owners.includes(node.owner ?? "Unknown")) &&
    (filters.tags.length === 0 ||
      filters.tags.some((tag) => (node.tags ?? []).includes(tag))) &&
    (!filters.hideIsolated ||
      (graph.incomingEdgeIdsByNodeId.get(node.id)?.length ?? 0) +
        (graph.outgoingEdgeIdsByNodeId.get(node.id)?.length ?? 0) >
        0)
  );
}

export function visibleNodeIds(graph: DomainGraph, filters: FilterState): Set<string> {
  return new Set(
    [...graph.nodesById.values()]
      .filter((node) => nodeMatchesFilters(node, graph, filters))
      .map((node) => node.id)
  );
}
