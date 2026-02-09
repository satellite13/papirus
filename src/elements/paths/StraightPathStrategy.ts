import type { Point } from '@/types';
import type { PathStrategy, PathStrategyOptions } from './PathStrategy';
import { distanceToSegment } from '@/utils/geometry';

/**
 * Straight line path strategy
 */
export class StraightPathStrategy implements PathStrategy {
  calculatePath(
    from: Point,
    to: Point,
    _fromDir?: string,
    _toDir?: string,
    _options?: PathStrategyOptions
  ): Point[] {
    return [from, to];
  }

  hitTest(point: Point, path: Point[], tolerance: number): boolean {
    if (path.length < 2) {
      return false;
    }
    return distanceToSegment(point, path[0]!, path[1]!) <= tolerance;
  }
}
