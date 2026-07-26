import { describe, expect, it } from "vitest";
import { findPath, searchNodes, traverse } from "../src/domain/algorithms";
import { normalizeGraph } from "../src/domain/graph";
import { fixtureDocument } from "../src/testing/fixture";

const graph = normalizeGraph(fixtureDocument());

describe("graph traversal", () => {
  it("traverses directionally to bounded depth and survives cycles", () => {
    expect([...traverse(graph, "a", "downstream", 1).nodeIds]).toEqual(["a", "b"]);
    expect(traverse(graph, "a", "downstream", 3).nodeIds).toEqual(new Set(["a", "b", "c"]));
    expect(traverse(graph, "a", "upstream", 2).nodeIds).toEqual(new Set(["a", "c", "b"]));
  });

  it("finds deterministic fewest-hop paths", () => {
    expect(findPath(graph, "a", "c")).toEqual({ nodeIds: ["a", "b", "c"], edgeIds: ["ab", "bc"] });
    expect(findPath(graph, "a", "a")).toEqual({ nodeIds: ["a"], edgeIds: [] });
    expect(findPath(graph, "a", "isolated")).toBeNull();
  });

  it("restricts paths by edge type", () => {
    expect(findPath(graph, "a", "c", new Set(["view_dependency"]))).toBeNull();
    expect(findPath(graph, "a", "b", new Set(["view_dependency"]))?.edgeIds).toEqual(["ab"]);
  });

  it("searches qualified name, tag, and owner", () => {
    expect(searchNodes(graph, "b.target")[0]?.id).toBe("c");
    expect(searchNodes(graph, "silver")[0]?.id).toBe("b");
    expect(searchNodes(graph, "team b").map((node) => node.id)).toContain("c");
  });
});
