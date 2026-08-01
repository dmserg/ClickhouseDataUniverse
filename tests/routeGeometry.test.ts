import { describe, expect, it } from "vitest";
import {
  buildPolylineMetrics,
  calculateRouteArrowPlacement,
  cargoShipBudget,
  samplePolyline
} from "../src/rendering/routeGeometry";

describe("route arrow placement", () => {
  it("points toward the target and clears its radius", () => {
    const placement = calculateRouteArrowPlacement([2, 3, 0], [10, 3, 0], 1.2, 10);

    expect(placement).not.toBeNull();
    expect(placement?.direction).toEqual([1, 0, 0]);
    expect(placement?.position[0]).toBeLessThan(10 - 1.2);
    expect(placement?.position[1]).toBe(3);
    expect(placement?.length).toBeCloseTo(0.55);
  });

  it("keeps marker dimensions bounded across route lengths", () => {
    const short = calculateRouteArrowPlacement([0, 0, 0], [2, 0, 0], 0.5, 2);
    const long = calculateRouteArrowPlacement([0, 0, 0], [100, 0, 0], 0.5, 100);

    expect(short?.length).toBeCloseTo(0.36);
    expect(long?.length).toBeCloseTo(0.9);
    expect(long?.width).toBeCloseTo(0.9 * 0.42);
  });

  it("returns no marker for a degenerate final segment", () => {
    expect(calculateRouteArrowPlacement([1, 1, 1], [1, 1, 1], 0.5, 4)).toBeNull();
  });
});

describe("cargo route sampling", () => {
  it("samples position and forward direction by traveled distance", () => {
    const metrics = buildPolylineMetrics([
      [0, 0, 0],
      [3, 0, 0],
      [3, 4, 0]
    ]);

    expect(metrics?.totalLength).toBe(7);
    expect(metrics && samplePolyline(metrics, 0.5)).toEqual({
      position: [3, 0.5, 0],
      direction: [0, 1, 0]
    });
  });

  it("rejects degenerate paths and clamps progress", () => {
    expect(buildPolylineMetrics([[0, 0, 0]])).toBeNull();
    expect(
      buildPolylineMetrics([
        [1, 1, 1],
        [1, 1, 1]
      ])
    ).toBeNull();
    const metrics = buildPolylineMetrics([
      [0, 0, 0],
      [2, 0, 0]
    ]);
    expect(metrics && samplePolyline(metrics, -1)?.position).toEqual([0, 0, 0]);
    expect(metrics && samplePolyline(metrics, 2)?.position).toEqual([2, 0, 0]);
  });

  it("skips repeated points without interrupting travel", () => {
    const metrics = buildPolylineMetrics([
      [0, 0, 0],
      [0, 0, 0],
      [2, 0, 0]
    ]);

    expect(metrics?.points).toHaveLength(2);
    expect(metrics && samplePolyline(metrics, 0.5)?.position).toEqual([1, 0, 0]);
  });

  it("uses quality-specific animation budgets", () => {
    expect(cargoShipBudget("Low")).toBe(6);
    expect(cargoShipBudget("Medium")).toBe(12);
    expect(cargoShipBudget("High")).toBe(20);
  });
});
