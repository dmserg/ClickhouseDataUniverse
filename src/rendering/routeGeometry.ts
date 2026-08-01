import type { Vector3Tuple } from "../layout/types";

export interface RouteArrowPlacement {
  position: Vector3Tuple;
  direction: Vector3Tuple;
  length: number;
  width: number;
}

export function calculateRouteArrowPlacement(
  approachPoint: Vector3Tuple,
  targetPoint: Vector3Tuple,
  targetRadius: number,
  routeDistance: number
): RouteArrowPlacement | null {
  const delta: Vector3Tuple = [
    targetPoint[0] - approachPoint[0],
    targetPoint[1] - approachPoint[1],
    targetPoint[2] - approachPoint[2]
  ];
  const tangentLength = Math.hypot(...delta);
  if (!Number.isFinite(tangentLength) || tangentLength < 1e-6 || routeDistance < 1e-6) {
    return null;
  }

  const direction: Vector3Tuple = [
    delta[0] / tangentLength,
    delta[1] / tangentLength,
    delta[2] / tangentLength
  ];
  const length = Math.min(0.9, Math.max(0.36, routeDistance * 0.055), routeDistance * 0.24);
  const width = length * 0.42;
  const offsetFromTarget = Math.max(0, targetRadius) + 0.14 + length / 2;

  return {
    position: [
      targetPoint[0] - direction[0] * offsetFromTarget,
      targetPoint[1] - direction[1] * offsetFromTarget,
      targetPoint[2] - direction[2] * offsetFromTarget
    ],
    direction,
    length,
    width
  };
}
