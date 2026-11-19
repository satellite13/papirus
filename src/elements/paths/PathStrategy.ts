import type { Point } from '@/types';

export interface PathObstacle {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Node id when obstacle comes from a diagram node; used to exclude endpoints only. */
  id?: string;
  role?: 'source' | 'target' | 'other';
}

/**
 * Path calculation strategy interface
 */
export interface PathStrategyOptions {
  controlPoints?: Point[];
  editablePolyline?: boolean;
  selfLoop?: boolean;
  obstacles?: PathObstacle[];
  /** Perpendicular stub before the end point when the route turns there. */
  endStubLength?: number;
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
