import type { JSONSchemaType } from "ajv";
import type { UniverseDocument } from "../domain/types";

// Ajv's generic schema type is intentionally not used here: its union inference
// becomes more restrictive than the versioned document's optional metadata shapes.
export const universeSchema = {
  $id: "clickhouse-universe-1.0",
  type: "object",
  additionalProperties: false,
  required: ["formatVersion", "universe", "schemas", "nodes", "edges", "layout"],
  properties: {
    formatVersion: { const: "1.0" },
    universe: {
      type: "object",
      additionalProperties: false,
      required: ["id", "name", "layoutSeed"],
      properties: {
        id: { type: "string", minLength: 1 },
        name: { type: "string", minLength: 1 },
        description: { type: "string" },
        generatedAt: { type: "string" },
        layoutSeed: { type: "integer" }
      }
    },
    schemas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "name"],
        properties: {
          id: { type: "string", minLength: 1 },
          name: { type: "string", minLength: 1 },
          displayName: { type: "string" },
          description: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          owner: { type: "string" },
          visualGroup: { type: "string" }
        }
      }
    },
    nodes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "schemaId", "name", "qualifiedName", "kind"],
        properties: {
          id: { type: "string", minLength: 1 },
          schemaId: { type: "string", minLength: 1 },
          name: { type: "string", minLength: 1 },
          qualifiedName: { type: "string", minLength: 1 },
          kind: {
            enum: [
              "table",
              "view",
              "materialized_view",
              "distributed_table",
              "external_table",
              "special_table"
            ]
          },
          description: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          owner: { type: "string" },
          metrics: {
            type: "object",
            additionalProperties: { type: ["number", "string", "boolean", "null"] }
          },
          table: {
            type: "object",
            additionalProperties: false,
            required: ["hasOwnData"],
            properties: {
              engine: { type: "string" },
              engineFamily: { type: "string" },
              hasOwnData: { type: "boolean" },
              rows: { type: "number", minimum: 0 },
              size: {
                type: "object",
                additionalProperties: false,
                required: ["kind", "scope", "isApproximate"],
                properties: {
                  bytes: { type: "number", minimum: 0 },
                  kind: {
                    enum: ["compressed", "uncompressed", "logical", "unknown"]
                  },
                  scope: {
                    enum: ["local", "shard", "cluster", "unique", "unknown"]
                  },
                  isApproximate: { type: "boolean" }
                }
              }
            }
          },
          view: {
            type: "object",
            additionalProperties: false,
            required: ["viewType"],
            properties: { viewType: { enum: ["normal", "live", "window", "other"] } }
          },
          materializedView: {
            type: "object",
            additionalProperties: false,
            required: ["mode"],
            properties: {
              mode: { enum: ["incremental", "refreshable", "other"] },
              targetNodeId: { type: "string" }
            }
          },
          distributedTable: {
            type: "object",
            additionalProperties: false,
            properties: {
              clusterName: { type: "string" },
              remoteSchema: { type: "string" },
              remoteTable: { type: "string" }
            }
          }
        }
      }
    },
    edges: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "sourceNodeId", "targetNodeId", "type"],
        properties: {
          id: { type: "string", minLength: 1 },
          sourceNodeId: { type: "string", minLength: 1 },
          targetNodeId: { type: "string", minLength: 1 },
          type: {
            enum: [
              "view_dependency",
              "materialized_view_input",
              "materialized_view_target",
              "etl_transfer",
              "distributed_reference",
              "manual_dependency",
              "unknown"
            ]
          },
          label: { type: "string" },
          metadata: {
            type: "object",
            additionalProperties: { type: ["number", "string", "boolean", "null"] }
          },
          tags: { type: "array", items: { type: "string" } }
        }
      }
    },
    layout: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["algorithmVersion"],
          properties: {
            algorithmVersion: { type: "string" },
            galaxies: {
              type: "object",
              additionalProperties: {
                type: "object",
                additionalProperties: false,
                required: ["position"],
                properties: {
                  position: {
                    type: "array",
                    minItems: 3,
                    maxItems: 3,
                    items: { type: "number" }
                  }
                }
              }
            },
            nodes: {
              type: "object",
              additionalProperties: {
                type: "object",
                additionalProperties: false,
                required: ["position"],
                properties: {
                  position: {
                    type: "array",
                    minItems: 3,
                    maxItems: 3,
                    items: { type: "number" }
                  }
                }
              }
            }
          }
        }
      ]
    }
  }
} as const satisfies Record<string, unknown>;

export type ValidUniverseDocument = JSONSchemaType<UniverseDocument>;
