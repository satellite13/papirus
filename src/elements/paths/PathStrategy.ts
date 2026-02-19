import type { Point } from '@/types';

export interface PathObstacle {
  x: number;
  y: number;
  width: number;
  height: number;
  role?: 'source' | 'target' | 'other';
}

/**
 * Path calculation strategy interface
 */
export interface PathStrategyOptions {
  controlPoints?: Point[];
  selfLoop?: boolean;
  obstacles?: PathObstacle[];
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
