import type { Point } from '@/types';
import type { PathStrategy, PathStrategyOptions } from './PathStrategy';
import {
  bezierPoint,
  distanceToSegment,
} from '@/utils/geometry';
import { BEZIER_MAX_OFFSET } from '@/constants';

/**
 * Get control point offset based on direction
 */
function getDirectionOffset(dir: string | undefined, distance: number): Point {
  const offset = Math.min(distance * 0.5, BEZIER_MAX_OFFSET);
  switch (dir) {
    case 'top':
      return { x: 0, y: -offset };
    case 'bottom':
      return { x: 0, y: offset };
    case 'left':
      return { x: -offset, y: 0 };
    case 'right':
      return { x: offset, y: 0 };
    default:
      return { x: 0, y: 0 };
  }
}

/**
 * Bezier curve path strategy
 */
export class BezierPathStrategy implements PathStrategy {
  calculatePath(
    from: Point,
    to: Point,
    fromDir?: string,
    toDir?: string,
    options?: PathStrategyOptions
  ): Point[] {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const controlPoints = options?.controlPoints;
    if (controlPoints && controlPoints.length > 0) {
      if (controlPoints.length >= 3 && controlPoints.length % 3 === 0) {
        return [from, ...controlPoints];
      }
      if (controlPoints.length === 2) {
        return [from, controlPoints[0]!, controlPoints[1]!, to];
      }
    }

    // If directions are specified, use them for control points
    if (fromDir || toDir) {
      const fromOffset = getDirectionOffset(fromDir, distance);
      const toOffset = getDirectionOffset(toDir, distance);

      return [
        from,
        { x: from.x + fromOffset.x, y: from.y + fromOffset.y },
        { x: to.x + toOffset.x, y: to.y + toOffset.y },
        to,
      ];
    }

    // Default behavior: auto-detect direction
    const offset = Math.min(Math.abs(dx), Math.abs(dy), BEZIER_MAX_OFFSET) * 0.5 + 50;

    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal dominant
      const offsetX = offset * Math.sign(dx || 1);
      return [
        from,
        { x: from.x + offsetX, y: from.y },
        { x: to.x - offsetX, y: to.y },
        to,
      ];
    } else {
      // Vertical dominant
      const offsetY = offset * Math.sign(dy || 1);
      return [
        from,
        { x: from.x, y: from.y + offsetY },
        { x: to.x, y: to.y - offsetY },
        to,
      ];
    }
  }

  hitTest(point: Point, path: Point[], tolerance: number): boolean {
    if (path.length < 4) {
      return false;
    }

    // Sample bezier curve and check distance to segments
    const samples = 20;
    const points: Point[] = [];

    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      points.push(bezierPoint(path[0]!, path[1]!, path[2]!, path[3]!, t));
    }

    for (let i = 1; i < points.length; i++) {
      if (distanceToSegment(point, points[i - 1]!, points[i]!) <= tolerance) {
        return true;
      }
    }

    return false;
  }
}
