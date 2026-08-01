import type { JSONSchemaType } from "ajv";
import sharedSchema from "../../schema/universe-1.0.schema.json";
import type { UniverseDocument } from "../domain/types";

// The versioned JSON artifact is shared with the standalone Python exporter.
export const universeSchema = sharedSchema as Record<string, unknown>;
export type ValidUniverseDocument = JSONSchemaType<UniverseDocument>;
