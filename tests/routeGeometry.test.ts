import { describe, expect, it } from "vitest";
import { calculateRouteArrowPlacement } from "../src/rendering/routeGeometry";

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
