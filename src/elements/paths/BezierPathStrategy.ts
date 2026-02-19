import type { Point } from '@/types';
import type { PathStrategy, PathStrategyOptions } from './PathStrategy';
import {
  bezierPoint,
  distanceToSegment,
} from '@/utils/geometry';
import { BEZIER_MAX_OFFSET } from '@/constants';

const SELF_LOOP_MIN_DISTANCE = 1;
const SELF_LOOP_OFFSET = 90;
const SELF_LOOP_SPREAD = 50;
const CORNER_BYPASS_DISTANCE = 220;
const CORNER_BYPASS_CLEARANCE = 80;
const OPPOSITE_BYPASS_DISTANCE = 280;
const OPPOSITE_BYPASS_CLEARANCE = 90;
const OPPOSITE_BYPASS_ARC = 120;

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

function createSelfLoopPath(point: Point, dir?: string): Point[] {
  switch (dir) {
    case 'bottom':
      return [
        point,
        { x: point.x - SELF_LOOP_SPREAD, y: point.y + SELF_LOOP_OFFSET },
        { x: point.x + SELF_LOOP_SPREAD, y: point.y + SELF_LOOP_OFFSET },
        point,
      ];
    case 'left':
      return [
        point,
        { x: point.x - SELF_LOOP_OFFSET, y: point.y + SELF_LOOP_SPREAD },
        { x: point.x - SELF_LOOP_OFFSET, y: point.y - SELF_LOOP_SPREAD },
        point,
      ];
    case 'right':
      return [
        point,
        { x: point.x + SELF_LOOP_OFFSET, y: point.y - SELF_LOOP_SPREAD },
        { x: point.x + SELF_LOOP_OFFSET, y: point.y + SELF_LOOP_SPREAD },
        point,
      ];
    case 'top':
    default:
      return [
        point,
        { x: point.x + SELF_LOOP_SPREAD, y: point.y - SELF_LOOP_OFFSET },
        { x: point.x - SELF_LOOP_SPREAD, y: point.y - SELF_LOOP_OFFSET },
        point,
      ];
  }
}

function isHorizontal(dir?: string): boolean {
  return dir === 'left' || dir === 'right';
}

function isVertical(dir?: string): boolean {
  return dir === 'top' || dir === 'bottom';
}

function isOppositeDirections(fromDir?: string, toDir?: string): boolean {
  return (
    (fromDir === 'left' && toDir === 'right') ||
    (fromDir === 'right' && toDir === 'left') ||
    (fromDir === 'top' && toDir === 'bottom') ||
    (fromDir === 'bottom' && toDir === 'top')
  );
}

function dirToVector(dir?: string): Point {
  switch (dir) {
    case 'top':
      return { x: 0, y: -1 };
    case 'bottom':
      return { x: 0, y: 1 };
    case 'left':
      return { x: -1, y: 0 };
    case 'right':
      return { x: 1, y: 0 };
    default:
      return { x: 0, y: 0 };
  }
}

function createOppositeBypassPath(from: Point, to: Point, fromDir?: string, toDir?: string): Point[] | null {
  if (!fromDir || !toDir || !isOppositeDirections(fromDir, toDir)) {
    return null;
  }

  const fromOut = dirToVector(fromDir);
  const toOut = dirToVector(toDir);

  if (isHorizontal(fromDir) && isHorizontal(toDir)) {
    // left<->right: arc above/below node instead of crossing through center.
    const sideY = from.x <= to.x ? -1 : 1;
    return [
      from,
      {
        x: from.x + fromOut.x * OPPOSITE_BYPASS_CLEARANCE,
        y: from.y + sideY * OPPOSITE_BYPASS_ARC,
      },
      {
        x: to.x + toOut.x * OPPOSITE_BYPASS_CLEARANCE,
        y: to.y + sideY * OPPOSITE_BYPASS_ARC,
      },
      to,
    ];
  }

  if (isVertical(fromDir) && isVertical(toDir)) {
    // top<->bottom: arc left/right from node instead of crossing through center.
    const sideX = from.y <= to.y ? 1 : -1;
    return [
      from,
      {
        x: from.x + sideX * OPPOSITE_BYPASS_ARC,
        y: from.y + fromOut.y * OPPOSITE_BYPASS_CLEARANCE,
      },
      {
        x: to.x + sideX * OPPOSITE_BYPASS_ARC,
        y: to.y + toOut.y * OPPOSITE_BYPASS_CLEARANCE,
      },
      to,
    ];
  }

  return null;
}

function createCornerBypassPath(from: Point, to: Point, fromDir?: string, toDir?: string): Point[] | null {
  if (!fromDir || !toDir) return null;
  const orthogonal =
    (isHorizontal(fromDir) && isVertical(toDir)) ||
    (isVertical(fromDir) && isHorizontal(toDir));
  if (!orthogonal) return null;

  const fromOut = dirToVector(fromDir);
  const toOut = dirToVector(toDir);
  const fromOuter = {
    x: from.x + fromOut.x * CORNER_BYPASS_CLEARANCE,
    y: from.y + fromOut.y * CORNER_BYPASS_CLEARANCE,
  };
  const toOuter = {
    x: to.x + toOut.x * CORNER_BYPASS_CLEARANCE,
    y: to.y + toOut.y * CORNER_BYPASS_CLEARANCE,
  };
  // Single cubic bezier: smooth outer detour without a middle kink.
  return [from, fromOuter, toOuter, to];
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
    const loopDir = fromDir ?? toDir;
    const selfLoop = options?.selfLoop ?? false;

    // For self-loop edges, build an explicit outer loop so the edge
    // does not pass under the node it is attached to.
    if (selfLoop && distance < SELF_LOOP_MIN_DISTANCE && loopDir) {
      return createSelfLoopPath(from, loopDir);
    }

    if (selfLoop && distance < OPPOSITE_BYPASS_DISTANCE) {
      const oppositeBypass = createOppositeBypassPath(from, to, fromDir, toDir);
      if (oppositeBypass) {
        return oppositeBypass;
      }
    }

    if (selfLoop && distance < CORNER_BYPASS_DISTANCE) {
      const cornerBypass = createCornerBypassPath(from, to, fromDir, toDir);
      if (cornerBypass) {
        return cornerBypass;
      }
    }

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
