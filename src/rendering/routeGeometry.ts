import type { Vector3Tuple } from "../layout/types";

export interface RouteArrowPlacement {
  position: Vector3Tuple;
  direction: Vector3Tuple;
  length: number;
  width: number;
}

export interface PolylineMetrics {
  points: readonly Vector3Tuple[];
  cumulativeLengths: readonly number[];
  totalLength: number;
}

export interface RouteSample {
  position: Vector3Tuple;
  direction: Vector3Tuple;
}

export function cargoShipBudget(quality: "Low" | "Medium" | "High"): number {
  return quality === "Low" ? 6 : quality === "High" ? 20 : 12;
}

export function buildPolylineMetrics(points: readonly Vector3Tuple[]): PolylineMetrics | null {
  if (points.length < 2) return null;
  const first = points[0];
  if (!first) return null;
  const sampledPoints: Vector3Tuple[] = [first];
  const cumulativeLengths = [0];
  let totalLength = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = sampledPoints[sampledPoints.length - 1];
    const current = points[index];
    if (!previous || !current) continue;
    const segmentLength = Math.hypot(
      current[0] - previous[0],
      current[1] - previous[1],
      current[2] - previous[2]
    );
    if (segmentLength < 1e-6) continue;
    totalLength += segmentLength;
    sampledPoints.push(current);
    cumulativeLengths.push(totalLength);
  }
  if (!Number.isFinite(totalLength) || totalLength < 1e-6) return null;
  return { points: sampledPoints, cumulativeLengths, totalLength };
}

export function samplePolyline(metrics: PolylineMetrics, progress: number): RouteSample | null {
  const distance = Math.min(1, Math.max(0, progress)) * metrics.totalLength;
  let segment = 1;
  while (
    segment < metrics.cumulativeLengths.length - 1 &&
    (metrics.cumulativeLengths[segment] ?? 0) < distance
  ) {
    segment += 1;
  }
  const start = metrics.points[segment - 1];
  const end = metrics.points[segment];
  const segmentStart = metrics.cumulativeLengths[segment - 1];
  const segmentEnd = metrics.cumulativeLengths[segment];
  if (!start || !end || segmentStart === undefined || segmentEnd === undefined) return null;
  const segmentLength = segmentEnd - segmentStart;
  if (segmentLength < 1e-6) return null;
  const localProgress = (distance - segmentStart) / segmentLength;
  const direction: Vector3Tuple = [
    (end[0] - start[0]) / segmentLength,
    (end[1] - start[1]) / segmentLength,
    (end[2] - start[2]) / segmentLength
  ];
  return {
    position: [
      start[0] + (end[0] - start[0]) * localProgress,
      start[1] + (end[1] - start[1]) * localProgress,
      start[2] + (end[2] - start[2]) * localProgress
    ],
    direction
  };
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
