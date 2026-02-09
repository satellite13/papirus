import type { Point } from '@/types';
import type { PathStrategy, PathStrategyOptions } from './PathStrategy';
import { distanceToSegment } from '@/utils/geometry';

const MIN_SEGMENT_LENGTH = 20;

/**
 * Polyline path strategy
 */
export class PolylinePathStrategy implements PathStrategy {
  calculatePath(
    from: Point,
    to: Point,
    fromDir?: string,
    toDir?: string,
    _options?: PathStrategyOptions
  ): Point[] {
    // If directions are specified, route accordingly
    if (fromDir || toDir) {
      return this.calculateDirectedPath(from, to, fromDir, toDir);
    }

    // Default behavior: auto-detect direction
    const midX = (from.x + to.x) / 2;

    // Horizontal-first routing
    if (Math.abs(to.x - from.x) > Math.abs(to.y - from.y)) {
      return [from, { x: midX, y: from.y }, { x: midX, y: to.y }, to];
    }

    // Vertical-first routing
    const midY = (from.y + to.y) / 2;
    return [from, { x: from.x, y: midY }, { x: to.x, y: midY }, to];
  }

  private calculateDirectedPath(from: Point, to: Point, fromDir?: string, toDir?: string): Point[] {
    const points: Point[] = [from];

    // Determine first segment based on fromDir
    const fromHorizontal = fromDir === 'left' || fromDir === 'right';
    const fromVertical = fromDir === 'top' || fromDir === 'bottom';
    const toHorizontal = toDir === 'left' || toDir === 'right';
    const toVertical = toDir === 'top' || toDir === 'bottom';

    if (fromVertical && toVertical) {
      // Both vertical: route with horizontal middle segment
      const midY = (from.y + to.y) / 2;
      const exitY = fromDir === 'top' ? Math.min(from.y - MIN_SEGMENT_LENGTH, midY) : Math.max(from.y + MIN_SEGMENT_LENGTH, midY);
      const entryY = toDir === 'top' ? Math.min(to.y - MIN_SEGMENT_LENGTH, midY) : Math.max(to.y + MIN_SEGMENT_LENGTH, midY);

      if (Math.abs(exitY - entryY) < 1) {
        points.push({ x: from.x, y: exitY });
        points.push({ x: to.x, y: exitY });
      } else {
        points.push({ x: from.x, y: exitY });
        points.push({ x: to.x, y: exitY });
      }
    } else if (fromHorizontal && toHorizontal) {
      // Both horizontal: route with vertical middle segment
      const midX = (from.x + to.x) / 2;
      const exitX = fromDir === 'left' ? Math.min(from.x - MIN_SEGMENT_LENGTH, midX) : Math.max(from.x + MIN_SEGMENT_LENGTH, midX);
      const entryX = toDir === 'left' ? Math.min(to.x - MIN_SEGMENT_LENGTH, midX) : Math.max(to.x + MIN_SEGMENT_LENGTH, midX);

      if (Math.abs(exitX - entryX) < 1) {
        points.push({ x: exitX, y: from.y });
        points.push({ x: exitX, y: to.y });
      } else {
        points.push({ x: exitX, y: from.y });
        points.push({ x: exitX, y: to.y });
      }
    } else if (fromVertical && toHorizontal) {
      // From vertical to horizontal
      points.push({ x: from.x, y: to.y });
    } else if (fromHorizontal && toVertical) {
      // From horizontal to vertical
      points.push({ x: to.x, y: from.y });
    } else {
      // Fallback: one corner
      const midX = (from.x + to.x) / 2;
      points.push({ x: midX, y: from.y });
      points.push({ x: midX, y: to.y });
    }

    points.push(to);
    return points;
  }

  hitTest(point: Point, path: Point[], tolerance: number): boolean {
    for (let i = 1; i < path.length; i++) {
      if (distanceToSegment(point, path[i - 1]!, path[i]!) <= tolerance) {
        return true;
      }
    }
    return false;
  }
}
