import type { EdgePathType, Point } from '@/types';
import { bezierPoint } from '@/utils/geometry';

export type PathPointAt = {
  point: Point;
  angle: number;
};

/**
 * Point and tangent angle at a normalized position along an edge path (0..1 by length).
 */
export function getPathPointAt(
  path: readonly Point[],
  type: EdgePathType,
  position: number
): PathPointAt {
  if (type !== 'bezier' || path.length < 4) {
    return getPointAlongPolyline(path, position);
  }

  const samples: Point[] = [];
  const steps = 20;
  for (let i = 1; i + 2 < path.length; i += 3) {
    const start = path[i - 1]!;
    const control1 = path[i]!;
    const control2 = path[i + 1]!;
    const end = path[i + 2]!;
    for (let sample = 0; sample <= steps; sample++) {
      const t = sample / steps;
      if (samples.length > 0 && t === 0) {
        continue;
      }
      samples.push(bezierPoint(start, control1, control2, end, t));
    }
  }
  return getPointAlongPolyline(samples, position);
}

export function getPointAlongPolyline(path: readonly Point[], position: number): PathPointAt {
  if (path.length === 0) {
    return { point: { x: 0, y: 0 }, angle: 0 };
  }
  if (path.length === 1) {
    return { point: path[0]!, angle: 0 };
  }

  let totalLength = 0;
  const segments: { start: Point; end: Point; length: number }[] = [];
  for (let i = 1; i < path.length; i++) {
    const start = path[i - 1]!;
    const end = path[i]!;
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    segments.push({ start, end, length });
    totalLength += length;
  }

  const targetLength = totalLength * Math.max(0, Math.min(1, position));
  let accumulated = 0;
  for (const segment of segments) {
    if (accumulated + segment.length >= targetLength) {
      const segmentPosition =
        segment.length > 0 ? (targetLength - accumulated) / segment.length : 0;
      return {
        point: {
          x: segment.start.x + segmentPosition * (segment.end.x - segment.start.x),
          y: segment.start.y + segmentPosition * (segment.end.y - segment.start.y),
        },
        angle: Math.atan2(segment.end.y - segment.start.y, segment.end.x - segment.start.x),
      };
    }
    accumulated += segment.length;
  }

  const lastSegment = segments[segments.length - 1]!;
  return {
    point: lastSegment.end,
    angle: Math.atan2(
      lastSegment.end.y - lastSegment.start.y,
      lastSegment.end.x - lastSegment.start.x
    ),
  };
}

/** Map tangent angle to a cardinal direction used by polyline routing. */
export function directionFromAngle(angle: number): string {
  const twoPi = Math.PI * 2;
  const a = ((angle % twoPi) + twoPi) % twoPi;
  if (a >= Math.PI * 0.25 && a < Math.PI * 0.75) return 'bottom';
  if (a >= Math.PI * 0.75 && a < Math.PI * 1.25) return 'left';
  if (a >= Math.PI * 1.25 && a < Math.PI * 1.75) return 'top';
  return 'right';
}

/**
 * Nearest point on an edge path to `point`, by sampling along normalized length.
 */
export function getClosestPointOnPath(
  path: readonly Point[],
  type: EdgePathType,
  point: Point,
  samples = 48
): { point: Point; pathParam: number; distance: number } | null {
  if (path.length < 2) {
    return null;
  }
  let bestPoint = getPathPointAt(path, type, 0).point;
  let bestParam = 0;
  let bestDistSq = Infinity;
  for (let i = 0; i <= samples; i++) {
    const pathParam = i / samples;
    const at = getPathPointAt(path, type, pathParam).point;
    const dx = at.x - point.x;
    const dy = at.y - point.y;
    const distSq = dx * dx + dy * dy;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestPoint = at;
      bestParam = pathParam;
    }
  }
  return {
    point: bestPoint,
    pathParam: bestParam,
    distance: Math.sqrt(bestDistSq),
  };
}
