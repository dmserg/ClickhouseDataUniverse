import { describe, expect, it } from "vitest";
import { normalizeGraph } from "../src/domain/graph";
import { DEFAULT_FILTERS, visibleNodeIds } from "../src/domain/filters";
import { fixtureDocument } from "../src/testing/fixture";

const graph = normalizeGraph(fixtureDocument());

describe("filters", () => {
  it("combines schema, kind, engine, size, tags, owner, and isolation filters", () => {
    expect(visibleNodeIds(graph, { ...DEFAULT_FILTERS, schemaIds: ["schema.a"] })).toEqual(new Set(["a", "b"]));
    expect(visibleNodeIds(graph, { ...DEFAULT_FILTERS, kinds: ["view"] })).toEqual(new Set(["b"]));
    expect(visibleNodeIds(graph, { ...DEFAULT_FILTERS, engineFamilies: ["Memory"] })).toEqual(new Set(["c"]));
    expect(visibleNodeIds(graph, { ...DEFAULT_FILTERS, minBytes: 2_000 })).toEqual(new Set(["c"]));
    expect(visibleNodeIds(graph, { ...DEFAULT_FILTERS, tags: ["silver"] })).toEqual(new Set(["b"]));
    expect(visibleNodeIds(graph, { ...DEFAULT_FILTERS, owners: ["Team B"] })).toEqual(new Set(["c"]));
    expect(visibleNodeIds(graph, { ...DEFAULT_FILTERS, hideIsolated: true }).has("isolated")).toBe(false);
  });

  it("does not mutate the source graph", () => {
    const size = graph.nodesById.size;
    visibleNodeIds(graph, { ...DEFAULT_FILTERS, kinds: ["view"] });
    expect(graph.nodesById.size).toBe(size);
  });
});
