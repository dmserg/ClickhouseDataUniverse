import { describe, expect, it } from "vitest";
import { normalizeGraph } from "../src/domain/graph";
import { calculateLayout, scaleTableRadius } from "../src/layout/layout";
import { fixtureDocument } from "../src/testing/fixture";

const graph = normalizeGraph(fixtureDocument());

describe("deterministic layout", () => {
  it("is stable for the same seed and changes with another seed", () => {
    const a = calculateLayout(graph, 42);
    const b = calculateLayout(graph, 42);
    const c = calculateLayout(graph, 43);
    expect(a.nodes).toEqual(b.nodes);
    expect(a.galaxies).toEqual(b.galaxies);
    expect(a.nodes).not.toEqual(c.nodes);
  });

  it("produces finite positions inside normalized galaxy bounds", () => {
    const result = calculateLayout(graph, 42);
    for (const item of Object.values(result.nodes)) {
      expect(item.position.every(Number.isFinite)).toBe(true);
      const galaxy = result.galaxies[item.schemaId]!;
      const distance = Math.hypot(
        item.position[0] - galaxy.position[0],
        item.position[1] - galaxy.position[1],
        item.position[2] - galaxy.position[2]
      );
      expect(distance).toBeLessThan(galaxy.radius * 1.5);
    }
    expect(result.galaxies["schema.a"]?.position).not.toEqual(result.galaxies["schema.b"]?.position);
  });

  it("fills a spherical volume with 1.5x intra-galaxy spacing", () => {
    const document = fixtureDocument();
    document.schemas = [document.schemas[0]!];
    document.nodes = Array.from({ length: 96 }, (_, index) => ({
      ...document.nodes[0]!,
      id: `table-${index}`,
      name: `table_${index}`,
      qualifiedName: `a.table_${index}`
    }));
    document.edges = [];
    const sphericalGraph = normalizeGraph(document);
    const result = calculateLayout(sphericalGraph, 42);
    const galaxy = result.galaxies["schema.a"]!;
    const positions = Object.values(result.nodes).map((node) => node.position);
    const span = (axis: 0 | 1 | 2) => {
      const values = positions.map((position) => position[axis]);
      return Math.max(...values) - Math.min(...values);
    };

    expect(galaxy.radius).toBeCloseTo((4.7 + Math.sqrt(96) * 1.3) * 1.5);
    expect(span(1)).toBeGreaterThan(Math.max(span(0), span(2)) * 0.7);
  });
});

describe("table size scaling", () => {
  it("is bounded, monotonic, and explicit for unknown sizes", () => {
    expect(scaleTableRadius(undefined, 1_000_000)).toBe(0.72);
    expect(scaleTableRadius(0, 1_000_000)).toBe(0.72);
    expect(scaleTableRadius(1, 1_000_000)).toBeGreaterThanOrEqual(0.55);
    expect(scaleTableRadius(1_000, 1_000_000)).toBeLessThan(scaleTableRadius(100_000, 1_000_000));
    expect(scaleTableRadius(1e20, 1_000_000)).toBeLessThanOrEqual(2.7);
  });
});
