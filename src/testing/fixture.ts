import type { UniverseDocument } from "../domain/types";

export function fixtureDocument(): UniverseDocument {
  return {
    formatVersion: "1.0",
    universe: { id: "test", name: "Test Universe", layoutSeed: 42 },
    schemas: [
      { id: "schema.a", name: "a", owner: "Team A" },
      { id: "schema.b", name: "b", owner: "Team B" }
    ],
    nodes: [
      {
        id: "a",
        schemaId: "schema.a",
        name: "source",
        qualifiedName: "a.source",
        kind: "table",
        owner: "Team A",
        tags: ["gold"],
        table: {
          engine: "MergeTree",
          engineFamily: "MergeTree",
          hasOwnData: true,
          size: { bytes: 1024, kind: "compressed", scope: "unique", isApproximate: false }
        }
      },
      {
        id: "b",
        schemaId: "schema.a",
        name: "middle",
        qualifiedName: "a.middle",
        kind: "view",
        owner: "Team A",
        tags: ["silver"],
        view: { viewType: "normal" }
      },
      {
        id: "c",
        schemaId: "schema.b",
        name: "target",
        qualifiedName: "b.target",
        kind: "table",
        owner: "Team B",
        tags: ["gold"],
        table: {
          engine: "Memory",
          engineFamily: "Memory",
          hasOwnData: true,
          size: { bytes: 1048576, kind: "compressed", scope: "local", isApproximate: true }
        }
      },
      {
        id: "isolated",
        schemaId: "schema.b",
        name: "isolated",
        qualifiedName: "b.isolated",
        kind: "distributed_table",
        table: {
          engine: "Distributed",
          engineFamily: "Distributed",
          hasOwnData: false,
          size: { kind: "unknown", scope: "unknown", isApproximate: false }
        }
      }
    ],
    edges: [
      { id: "ab", sourceNodeId: "a", targetNodeId: "b", type: "view_dependency" },
      { id: "bc", sourceNodeId: "b", targetNodeId: "c", type: "etl_transfer" },
      { id: "ca", sourceNodeId: "c", targetNodeId: "a", type: "manual_dependency" }
    ],
    layout: null
  };
}
