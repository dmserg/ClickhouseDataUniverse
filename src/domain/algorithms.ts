import type { DomainGraph, EdgeType, GraphPath } from "./types";

export function traverse(
  graph: DomainGraph,
  startNodeId: string,
  direction: "upstream" | "downstream",
  maxDepth: number
): { nodeIds: Set<string>; edgeIds: Set<string> } {
  const nodeIds = new Set([startNodeId]);
  const edgeIds = new Set<string>();
  const queue: Array<{ id: string; depth: number }> = [{ id: startNodeId, depth: 0 }];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || current.depth >= maxDepth) continue;
    const ids =
      direction === "downstream"
        ? graph.outgoingEdgeIdsByNodeId.get(current.id)
        : graph.incomingEdgeIdsByNodeId.get(current.id);
    for (const edgeId of ids ?? []) {
      const edge = graph.edgesById.get(edgeId);
      if (!edge) continue;
      edgeIds.add(edgeId);
      const nextId = direction === "downstream" ? edge.targetNodeId : edge.sourceNodeId;
      if (!nodeIds.has(nextId)) {
        nodeIds.add(nextId);
        queue.push({ id: nextId, depth: current.depth + 1 });
      }
    }
  }
  return { nodeIds, edgeIds };
}

export function findPath(
  graph: DomainGraph,
  sourceId: string,
  targetId: string,
  allowedTypes?: ReadonlySet<EdgeType>
): GraphPath | null {
  if (!graph.nodesById.has(sourceId) || !graph.nodesById.has(targetId)) return null;
  if (sourceId === targetId) return { nodeIds: [sourceId], edgeIds: [] };
  const visited = new Set([sourceId]);
  const queue = [sourceId];
  const previous = new Map<string, { nodeId: string; edgeId: string }>();
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    const edgeIds = [...(graph.outgoingEdgeIdsByNodeId.get(current) ?? [])].sort();
    for (const edgeId of edgeIds) {
      const edge = graph.edgesById.get(edgeId);
      if (!edge || (allowedTypes && !allowedTypes.has(edge.type))) continue;
      if (visited.has(edge.targetNodeId)) continue;
      visited.add(edge.targetNodeId);
      previous.set(edge.targetNodeId, { nodeId: current, edgeId });
      if (edge.targetNodeId === targetId) {
        const nodeIds = [targetId];
        const pathEdgeIds: string[] = [];
        let cursor = targetId;
        while (cursor !== sourceId) {
          const step = previous.get(cursor);
          if (!step) return null;
          pathEdgeIds.unshift(step.edgeId);
          nodeIds.unshift(step.nodeId);
          cursor = step.nodeId;
        }
        return { nodeIds, edgeIds: pathEdgeIds };
      }
      queue.push(edge.targetNodeId);
    }
  }
  return null;
}

export function searchNodes(graph: DomainGraph, query: string, limit = 12) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return [];
  return [...graph.nodesById.values()]
    .map((node) => {
      const haystack = [
        node.qualifiedName,
        node.name,
        node.owner ?? "",
        ...(node.tags ?? [])
      ].join(" ").toLocaleLowerCase();
      const index = haystack.indexOf(normalized);
      return { node, score: index < 0 ? Infinity : index };
    })
    .filter(({ score }) => Number.isFinite(score))
    .sort((a, b) => a.score - b.score || a.node.qualifiedName.localeCompare(b.node.qualifiedName))
    .slice(0, limit)
    .map(({ node }) => node);
}
