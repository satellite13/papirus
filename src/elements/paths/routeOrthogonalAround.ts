import type { Point } from '@/types';

export type Side = 'top' | 'right' | 'bottom' | 'left';

export type RouteRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  id?: string;
};

export type RouteOrthogonalAroundInput = {
  from: Point;
  to: Point;
  fromDir: Side;
  toDir: Side;
  parent?: RouteRect;
  target?: RouteRect;
  margin?: number;
  exitDistance?: number;
};

export function routeOrthogonalAround(_input: RouteOrthogonalAroundInput): Point[] {
  throw new Error('not implemented');
}
