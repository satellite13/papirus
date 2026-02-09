import type { Point } from '@/types';

/**
 * Path calculation strategy interface
 */
export interface PathStrategyOptions {
  controlPoints?: Point[];
}

export interface PathStrategy {
  calculatePath(
    from: Point,
    to: Point,
    fromDir?: string,
    toDir?: string,
    options?: PathStrategyOptions
  ): Point[];
  hitTest(point: Point, path: Point[], tolerance: number): boolean;
}
