import type { ErrorObject } from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import { normalizeGraph, validateReferences } from "../domain/graph";
import type { LoadResult, UniverseDocument, ValidationIssue } from "../domain/types";
import { universeSchema } from "./universeSchema";

const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
const validate = ajv.compile<UniverseDocument>(universeSchema);

function schemaIssue(error: ErrorObject): ValidationIssue {
  return {
    path: error.instancePath || "/",
    message:
      error.keyword === "additionalProperties"
        ? `Unknown property "${String(error.params.additionalProperty)}"`
        : error.message ?? "Invalid value"
  };
}

export function loadUniverse(input: unknown): LoadResult {
  if (!validate(input)) {
    return { ok: false, issues: (validate.errors ?? []).map(schemaIssue) };
  }
  const issues = validateReferences(input);
  if (issues.length > 0) return { ok: false, issues };
  const started = performance.now();
  const graph = normalizeGraph(input);
  return { ok: true, graph, normalizationMs: performance.now() - started };
}

export async function loadUniverseUrl(url: string): Promise<LoadResult> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return loadUniverse(await response.json());
  } catch (error) {
    return {
      ok: false,
      issues: [{ path: "/", message: `Could not load dataset: ${String(error)}` }]
    };
  }
}
