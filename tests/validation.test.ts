import { describe, expect, it } from "vitest";
import { loadUniverse } from "../src/import/loadUniverse";
import { fixtureDocument } from "../src/testing/fixture";

describe("input validation", () => {
  it("accepts and indexes a valid document", () => {
    const result = loadUniverse(fixtureDocument());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.graph.nodesById.size).toBe(4);
      expect(result.graph.outgoingEdgeIdsByNodeId.get("a")).toEqual(["ab"]);
      expect(result.graph.incomingEdgeIdsByNodeId.get("a")).toEqual(["ca"]);
      expect(result.graph.nodeIdsBySchemaId.get("schema.b")).toEqual(["c", "isolated"]);
    }
  });

  it("rejects unsupported format versions with a path", () => {
    const input = { ...fixtureDocument(), formatVersion: "2.0" };
    const result = loadUniverse(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0]?.path).toBe("/formatVersion");
  });

  it.each([
    ["duplicate node", (doc: ReturnType<typeof fixtureDocument>) => doc.nodes.push({ ...doc.nodes[0]! })],
    ["missing schema", (doc: ReturnType<typeof fixtureDocument>) => (doc.nodes[0]!.schemaId = "missing")],
    ["missing source", (doc: ReturnType<typeof fixtureDocument>) => (doc.edges[0]!.sourceNodeId = "missing")],
    ["missing target", (doc: ReturnType<typeof fixtureDocument>) => (doc.edges[0]!.targetNodeId = "missing")]
  ])("rejects %s references", (_label, mutate) => {
    const input = fixtureDocument();
    mutate(input);
    const result = loadUniverse(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0]?.message).toMatch(/Duplicate|missing/);
  });

  it("rejects unknown properties and invalid enums", () => {
    const input = fixtureDocument() as unknown as Record<string, unknown>;
    input.extra = true;
    const result = loadUniverse(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0]?.message).toContain("Unknown property");
  });

  it("allows an explicitly empty graph", () => {
    const input = fixtureDocument();
    input.schemas = [];
    input.nodes = [];
    input.edges = [];
    expect(loadUniverse(input).ok).toBe(true);
  });
});
