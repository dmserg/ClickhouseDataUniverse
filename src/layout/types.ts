export type Vector3Tuple = [number, number, number];

export interface GalaxyLayout {
  schemaId: string;
  position: Vector3Tuple;
  radius: number;
  nodeCount: number;
}

export interface NodeLayout {
  nodeId: string;
  schemaId: string;
  position: Vector3Tuple;
  radius: number;
  importance: number;
}

export interface AggregateRoute {
  id: string;
  sourceSchemaId: string;
  targetSchemaId: string;
  edgeCount: number;
  points: [Vector3Tuple, Vector3Tuple, Vector3Tuple];
}

export interface LayoutResult {
  algorithmVersion: "prototype-1";
  seed: number;
  galaxies: Record<string, GalaxyLayout>;
  nodes: Record<string, NodeLayout>;
  aggregateRoutes: AggregateRoute[];
  durationMs: number;
}
