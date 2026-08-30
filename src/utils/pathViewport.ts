import type { Bounds, EdgePathType, Point } from '@/types';
import {
  bezierPoint,
  pointInRect,
  rectsIntersect,
  segmentRectIntersections,
} from '@/utils/geometry';

export interface EdgePathViewportInput {
  path: readonly Point[];
  type?: EdgePathType;
}

/**
 * True when the drawn edge path meets the viewport.
 * AABB-only cull keeps fat bezier control boxes on the walk even when the
 * curve never enters the view. Empty path stays visible for the first layout.
 */
export function edgePathIntersectsViewport(
  input: EdgePathViewportInput,
  viewport: Bounds
): boolean {
  const path = input.path;
  if (path.length === 0) {
    return true;
  }

  const aabb = boundsFromPoints(path);
  if (aabb === null || !rectsIntersect(aabb, viewport)) {
    return false;
  }

  if (input.type === 'bezier' && path.length >= 4) {
    return polylineIntersectsRect(sampleBezier(path), viewport);
  }

  return polylineIntersectsRect(path, viewport);
}

function boundsFromPoints(points: readonly Point[]): Bounds | null {
  if (points.length === 0) {
    return null;
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function polylineIntersectsRect(points: readonly Point[], rect: Bounds): boolean {
  if (points.length === 1) {
    return pointInRect(points[0]!, rect);
  }
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i]!;
    const end = points[i + 1]!;
    if (pointInRect(start, rect) || pointInRect(end, rect)) {
      return true;
    }
    if (segmentRectIntersections(start, end, rect).length > 0) {
      return true;
    }
  }
  return false;
}

function sampleBezier(path: readonly Point[]): Point[] {
  const samples: Point[] = [];
  const steps = 20;
  for (let i = 1; i + 2 < path.length; i += 3) {
    const p0 = path[i - 1]!;
    const p1 = path[i]!;
    const p2 = path[i + 1]!;
    const p3 = path[i + 2]!;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      if (samples.length > 0 && t === 0) {
        continue;
      }
      samples.push(bezierPoint(p0, p1, p2, p3, t));
    }
  }
  return samples;
}
