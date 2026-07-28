// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadUniverse } from "../src/import/loadUniverse";
import { calculateLayout } from "../src/layout/layout";
import { DEFAULT_FILTERS, visibleNodeIds } from "../src/domain/filters";

describe("large deterministic workload", () => {
  it("normalizes, lays out, and filters within prototype budgets", () => {
    const document = JSON.parse(
      readFileSync("public/mock/universe-large.json", "utf8")
    ) as unknown;
    const started = performance.now();
    const result = loadUniverse(document);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const layout = calculateLayout(result.graph, result.graph.document.universe.layoutSeed);
    const startupMs = performance.now() - started;
    const filterStarted = performance.now();
    const visible = visibleNodeIds(result.graph, {
      ...DEFAULT_FILTERS,
      schemaIds: ["schema.tatooine", "schema.naboo"],
      engineFamilies: ["MergeTree"],
      minBytes: 1024 ** 3
    });
    const filterMs = performance.now() - filterStarted;
    expect(result.graph.nodesById.size).toBe(3000);
    expect(result.graph.edgesById.size).toBeGreaterThan(30_000);
    expect(Object.keys(layout.nodes)).toHaveLength(3000);
    expect(visible.size).toBeGreaterThan(0);
    expect(startupMs).toBeLessThan(5000);
    expect(filterMs).toBeLessThan(300);
  });
});
