import type {
  DomainGraph,
  EdgeInput,
  EdgeType,
  NodeInput,
  SchemaInput,
  UniverseDocument,
  ValidationIssue
} from "./types";

function pushToIndex<K>(map: Map<K, string[]>, key: K, value: string) {
  const bucket = map.get(key);
  if (bucket) bucket.push(value);
  else map.set(key, [value]);
}

function duplicateIssues<T extends { id: string }>(values: T[], path: string): ValidationIssue[] {
  const seen = new Set<string>();
  return values.flatMap((value, index) => {
    if (seen.has(value.id)) {
      return [{ path: `${path}/${index}/id`, message: `Duplicate ID "${value.id}"`, entityId: value.id }];
    }
    seen.add(value.id);
    return [];
  });
}

export function validateReferences(document: UniverseDocument): ValidationIssue[] {
  const issues = [
    ...duplicateIssues(document.schemas, "/schemas"),
    ...duplicateIssues(document.nodes, "/nodes"),
    ...duplicateIssues(document.edges, "/edges")
  ];
  const schemaIds = new Set(document.schemas.map((schema) => schema.id));
  const nodeIds = new Set(document.nodes.map((node) => node.id));

  document.nodes.forEach((node, index) => {
    if (!schemaIds.has(node.schemaId)) {
      issues.push({
        path: `/nodes/${index}/schemaId`,
        message: `Node "${node.id}" references missing schema "${node.schemaId}"`,
        entityId: node.id
      });
    }
    const target = node.materializedView?.targetNodeId;
    if (target && !nodeIds.has(target)) {
      issues.push({
        path: `/nodes/${index}/materializedView/targetNodeId`,
        message: `Materialized view "${node.id}" references missing target "${target}"`,
        entityId: node.id
      });
    }
  });
  document.edges.forEach((edge, index) => {
    if (!nodeIds.has(edge.sourceNodeId)) {
      issues.push({
        path: `/edges/${index}/sourceNodeId`,
        message: `Edge "${edge.id}" references missing source "${edge.sourceNodeId}"`,
        entityId: edge.id
      });
    }
    if (!nodeIds.has(edge.targetNodeId)) {
      issues.push({
        path: `/edges/${index}/targetNodeId`,
        message: `Edge "${edge.id}" references missing target "${edge.targetNodeId}"`,
        entityId: edge.id
      });
    }
  });
  return issues;
}

export function normalizeGraph(document: UniverseDocument): DomainGraph {
  const schemasById = new Map<string, SchemaInput>();
  const nodesById = new Map<string, NodeInput>();
  const edgesById = new Map<string, EdgeInput>();
  const outgoingEdgeIdsByNodeId = new Map<string, string[]>();
  const incomingEdgeIdsByNodeId = new Map<string, string[]>();
  const nodeIdsBySchemaId = new Map<string, string[]>();
  const edgeIdsByType = new Map<EdgeType, string[]>();

  for (const schema of document.schemas) schemasById.set(schema.id, schema);
  for (const node of document.nodes) {
    nodesById.set(node.id, node);
    pushToIndex(nodeIdsBySchemaId, node.schemaId, node.id);
    outgoingEdgeIdsByNodeId.set(node.id, []);
    incomingEdgeIdsByNodeId.set(node.id, []);
  }
  for (const edge of document.edges) {
    edgesById.set(edge.id, edge);
    pushToIndex(outgoingEdgeIdsByNodeId, edge.sourceNodeId, edge.id);
    pushToIndex(incomingEdgeIdsByNodeId, edge.targetNodeId, edge.id);
    pushToIndex(edgeIdsByType, edge.type, edge.id);
  }
  return {
    document,
    schemasById,
    nodesById,
    edgesById,
    outgoingEdgeIdsByNodeId,
    incomingEdgeIdsByNodeId,
    nodeIdsBySchemaId,
    edgeIdsByType
  };
}
