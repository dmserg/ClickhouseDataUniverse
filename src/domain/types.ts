export const NODE_KINDS = [
  "table",
  "view",
  "materialized_view",
  "distributed_table",
  "external_table",
  "special_table"
] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

export const EDGE_TYPES = [
  "view_dependency",
  "materialized_view_input",
  "materialized_view_target",
  "etl_transfer",
  "distributed_reference",
  "manual_dependency",
  "unknown"
] as const;
export type EdgeType = (typeof EDGE_TYPES)[number];

export type SizeKind = "compressed" | "uncompressed" | "logical" | "unknown";
export type SizeScope = "local" | "shard" | "cluster" | "unique" | "unknown";

export interface UniverseMetadata {
  id: string;
  name: string;
  description?: string;
  generatedAt?: string;
  layoutSeed: number;
}

export interface SchemaInput {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  tags?: string[];
  owner?: string;
  visualGroup?: string;
}

export interface SizeMetadata {
  bytes?: number;
  kind: SizeKind;
  scope: SizeScope;
  isApproximate: boolean;
}

export interface TableMetadata {
  engine?: string;
  engineFamily?: string;
  hasOwnData: boolean;
  size?: SizeMetadata;
  rows?: number;
}

export interface NodeInput {
  id: string;
  schemaId: string;
  name: string;
  qualifiedName: string;
  kind: NodeKind;
  description?: string;
  tags?: string[];
  owner?: string;
  metrics?: Record<string, number | string | boolean | null>;
  table?: TableMetadata;
  view?: { viewType: "normal" | "live" | "window" | "other" };
  materializedView?: {
    mode: "incremental" | "refreshable" | "other";
    targetNodeId?: string;
  };
  distributedTable?: {
    clusterName?: string;
    remoteSchema?: string;
    remoteTable?: string;
  };
}

export interface EdgeInput {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  type: EdgeType;
  label?: string;
  metadata?: Record<string, number | string | boolean | null>;
  tags?: string[];
}

export interface InputLayout {
  algorithmVersion: string;
  galaxies?: Record<string, { position: [number, number, number] }>;
  nodes?: Record<string, { position: [number, number, number] }>;
}

export interface UniverseDocument {
  formatVersion: "1.0";
  universe: UniverseMetadata;
  schemas: SchemaInput[];
  nodes: NodeInput[];
  edges: EdgeInput[];
  layout: InputLayout | null;
}

export interface DomainGraph {
  readonly document: UniverseDocument;
  readonly schemasById: ReadonlyMap<string, SchemaInput>;
  readonly nodesById: ReadonlyMap<string, NodeInput>;
  readonly edgesById: ReadonlyMap<string, EdgeInput>;
  readonly outgoingEdgeIdsByNodeId: ReadonlyMap<string, readonly string[]>;
  readonly incomingEdgeIdsByNodeId: ReadonlyMap<string, readonly string[]>;
  readonly nodeIdsBySchemaId: ReadonlyMap<string, readonly string[]>;
  readonly edgeIdsByType: ReadonlyMap<EdgeType, readonly string[]>;
}

export interface GraphPath {
  nodeIds: string[];
  edgeIds: string[];
}

export interface FilterState {
  schemaIds: string[];
  kinds: NodeKind[];
  engineFamilies: string[];
  minBytes: number | null;
  maxBytes: number | null;
  edgeTypes: EdgeType[];
  owners: string[];
  tags: string[];
  hideIsolated: boolean;
}

export interface ValidationIssue {
  path: string;
  message: string;
  entityId?: string;
}

export type LoadResult =
  | { ok: true; graph: DomainGraph; normalizationMs: number }
  | { ok: false; issues: ValidationIssue[] };
