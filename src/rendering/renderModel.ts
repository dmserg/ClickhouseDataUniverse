import type { DomainGraph, NodeKind } from "../domain/types";
import type { LayoutResult } from "../layout/types";

export interface InstanceBatch {
  kind: NodeKind;
  ids: string[];
  matrices: Float32Array;
  colors: Float32Array;
}

const KIND_ORDER: NodeKind[] = [
  "table",
  "view",
  "materialized_view",
  "distributed_table",
  "external_table",
  "special_table"
];

const PALETTE: Record<string, [number, number, number, number]> = {
  MergeTree: [1, 0.73, 0.25, 1],
  Log: [0.36, 0.82, 1, 1],
  Memory: [0.89, 0.43, 1, 1],
  Integration: [0.32, 1, 0.69, 1],
  Distributed: [0.2, 0.93, 1, 1],
  Special: [1, 0.46, 0.57, 1],
  Unknown: [0.64, 0.69, 0.78, 1]
};

export function engineColor(family: string | undefined): [number, number, number, number] {
  return PALETTE[family ?? "Unknown"] ?? PALETTE.Unknown!;
}

export function createRenderModel(graph: DomainGraph, layout: LayoutResult): InstanceBatch[] {
  return KIND_ORDER.map((kind) => {
    const values = [...graph.nodesById.values()].filter((node) => node.kind === kind);
    const matrices = new Float32Array(values.length * 16);
    const colors = new Float32Array(values.length * 4);
    values.forEach((node, index) => {
      const item = layout.nodes[node.id];
      if (!item) return;
      const base = index * 16;
      matrices[base] = item.radius;
      matrices[base + 5] = item.radius;
      matrices[base + 10] = item.radius;
      matrices[base + 12] = item.position[0];
      matrices[base + 13] = item.position[1];
      matrices[base + 14] = item.position[2];
      matrices[base + 15] = 1;
      colors.set(engineColor(node.table?.engineFamily), index * 4);
    });
    return { kind, ids: values.map((node) => node.id), matrices, colors };
  }).filter((batch) => batch.ids.length > 0);
}
