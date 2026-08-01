import type { DomainGraph, NodeInput } from "../domain/types";
import type {
  AggregateRoute,
  GalaxyLayout,
  LayoutResult,
  NodeLayout,
  Vector3Tuple
} from "./types";

const INTRA_GALAXY_SPACING = 1.5;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(value: string, seed: number): number {
  let hash = seed ^ 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function scaleTableRadius(bytes: number | undefined, percentile95: number): number {
  if (bytes === undefined || !Number.isFinite(bytes) || bytes <= 0) return 0.72;
  const ceiling = Math.max(percentile95, 1);
  const normalized = Math.log10(1 + Math.min(bytes, ceiling)) / Math.log10(1 + ceiling);
  return Math.min(2.7, Math.max(0.55, 0.55 + normalized * 2.15));
}

function percentile(values: number[], fraction: number): number {
  if (values.length === 0) return 1;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * fraction));
  return sorted[index] ?? 1;
}

function importance(graph: DomainGraph, node: NodeInput): number {
  return (
    (graph.incomingEdgeIdsByNodeId.get(node.id)?.length ?? 0) +
    (graph.outgoingEdgeIdsByNodeId.get(node.id)?.length ?? 0) +
    Math.log10(1 + (node.table?.size?.bytes ?? 0))
  );
}

function midpointArc(a: Vector3Tuple, b: Vector3Tuple): Vector3Tuple {
  return [(a[0] + b[0]) / 2, Math.max(a[1], b[1]) + 8, (a[2] + b[2]) / 2];
}

export function calculateLayout(graph: DomainGraph, seed: number): LayoutResult {
  const started = performance.now();
  const galaxies: Record<string, GalaxyLayout> = {};
  const nodes: Record<string, NodeLayout> = {};
  const schemas = [...graph.schemasById.values()].sort((a, b) => a.id.localeCompare(b.id));
  const universeRadius = Math.max(34, schemas.length * 7.5);

  schemas.forEach((schema, index) => {
    const count = graph.nodeIdsBySchemaId.get(schema.id)?.length ?? 0;
    const angle = (index / Math.max(1, schemas.length)) * Math.PI * 2;
    const jitter = mulberry32(hashString(schema.id, seed))();
    const ring = universeRadius * (0.55 + jitter * 0.38);
    const hint = graph.document.layout?.galaxies?.[schema.id]?.position;
    galaxies[schema.id] = {
      schemaId: schema.id,
      position: hint ?? [Math.cos(angle) * ring, (jitter - 0.5) * 12, Math.sin(angle) * ring],
      radius: Math.max(7, 4.7 + Math.sqrt(count) * 1.3) * INTRA_GALAXY_SPACING,
      nodeCount: count
    };
  });

  const ownedSizes = [...graph.nodesById.values()]
    .map((node) => node.table?.size?.bytes)
    .filter((value): value is number => value !== undefined && value > 0);
  const p95 = percentile(ownedSizes, 0.95);

  for (const schema of schemas) {
    const galaxy = galaxies[schema.id];
    if (!galaxy) continue;
    const localNodes = (graph.nodeIdsBySchemaId.get(schema.id) ?? [])
      .map((id) => graph.nodesById.get(id))
      .filter((node): node is NodeInput => Boolean(node))
      .sort((a, b) => importance(graph, b) - importance(graph, a) || a.id.localeCompare(b.id));
    localNodes.forEach((node, index) => {
      const random = mulberry32(hashString(node.id, seed));
      const theta = index * GOLDEN_ANGLE + random() * 0.45;
      const vertical = random() * 2 - 1;
      const horizontal = Math.sqrt(Math.max(0, 1 - vertical * vertical));
      const fraction =
        localNodes.length <= 1 ? 0 : Math.cbrt(index / (localNodes.length - 1));
      const distance = galaxy.radius * (0.08 + fraction * 0.78) * (0.92 + random() * 0.16);
      const hint = graph.document.layout?.nodes?.[node.id]?.position;
      const position: Vector3Tuple =
        hint ??
        [
          galaxy.position[0] + Math.cos(theta) * horizontal * distance,
          galaxy.position[1] + vertical * distance,
          galaxy.position[2] + Math.sin(theta) * horizontal * distance
        ];
      nodes[node.id] = {
        nodeId: node.id,
        schemaId: schema.id,
        position,
        radius:
          node.kind === "view"
            ? 0.48
            : node.kind === "materialized_view"
              ? Math.max(0.65, scaleTableRadius(node.table?.size?.bytes, p95) * 0.75)
              : scaleTableRadius(node.table?.size?.bytes, p95),
        importance: importance(graph, node)
      };
    });
  }

  // Views gravitate toward the centroid of incoming dependencies without continuous simulation.
  for (const node of graph.nodesById.values()) {
    if (node.kind !== "view" && node.kind !== "materialized_view") continue;
    const layout = nodes[node.id];
    if (!layout) continue;
    const dependencies = (graph.incomingEdgeIdsByNodeId.get(node.id) ?? [])
      .map((id) => graph.edgesById.get(id))
      .map((edge) => (edge ? nodes[edge.sourceNodeId]?.position : undefined))
      .filter((position): position is Vector3Tuple => Boolean(position));
    if (dependencies.length > 0) {
      const centroid = dependencies.reduce<Vector3Tuple>(
        (sum, value) => [sum[0] + value[0], sum[1] + value[1], sum[2] + value[2]],
        [0, 0, 0]
      );
      const random = mulberry32(hashString(node.id, seed ^ 0x9e3779b9));
      const theta = random() * Math.PI * 2;
      const vertical = random() * 2 - 1;
      const horizontal = Math.sqrt(Math.max(0, 1 - vertical * vertical));
      const offset = 2.2 * INTRA_GALAXY_SPACING;
      layout.position = [
        centroid[0] / dependencies.length + Math.cos(theta) * horizontal * offset,
        centroid[1] / dependencies.length + vertical * offset,
        centroid[2] / dependencies.length + Math.sin(theta) * horizontal * offset
      ];
    }
  }

  const aggregate = new Map<string, number>();
  for (const edge of graph.edgesById.values()) {
    const source = graph.nodesById.get(edge.sourceNodeId);
    const target = graph.nodesById.get(edge.targetNodeId);
    if (!source || !target || source.schemaId === target.schemaId) continue;
    const key = `${source.schemaId}→${target.schemaId}`;
    aggregate.set(key, (aggregate.get(key) ?? 0) + 1);
  }
  const aggregateRoutes: AggregateRoute[] = [...aggregate.entries()]
    .map(([key, edgeCount]) => {
      const [sourceSchemaId = "", targetSchemaId = ""] = key.split("→");
      const source = galaxies[sourceSchemaId]?.position ?? [0, 0, 0];
      const target = galaxies[targetSchemaId]?.position ?? [0, 0, 0];
      return {
        id: key,
        sourceSchemaId,
        targetSchemaId,
        edgeCount,
        points: [source, midpointArc(source, target), target] as [
          Vector3Tuple,
          Vector3Tuple,
          Vector3Tuple
        ]
      };
    })
    .sort((a, b) => b.edgeCount - a.edgeCount || a.id.localeCompare(b.id));

  return {
    algorithmVersion: "prototype-2",
    seed,
    galaxies,
    nodes,
    aggregateRoutes,
    durationMs: performance.now() - started
  };
}
