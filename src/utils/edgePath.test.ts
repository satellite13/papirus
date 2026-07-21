import { describe, expect, it } from 'vitest';
import {
  directionFromAngle,
  getClosestPointOnPath,
  getPathPointAt,
  getPointAlongPolyline,
} from './edgePath';

describe('getPointAlongPolyline', () => {
  it('returns midpoint for position 0.5 on a straight segment', () => {
    const { point, angle } = getPointAlongPolyline(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      0.5
    );
    expect(point).toEqual({ x: 50, y: 0 });
    expect(angle).toBeCloseTo(0);
  });
});

describe('getPathPointAt', () => {
  it('samples bezier path by arc length', () => {
    const { point } = getPathPointAt(
      [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 0 },
      ],
      'bezier',
      0.5
    );
    expect(point.x).toBeGreaterThan(40);
    expect(point.x).toBeLessThan(60);
  });
});

describe('getClosestPointOnPath', () => {
  it('finds nearest point on a horizontal segment', () => {
    const closest = getClosestPointOnPath(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      'straight',
      { x: 40, y: 25 }
    );
    expect(closest).toBeTruthy();
    expect(closest!.point.x).toBeCloseTo(40, 0);
    expect(closest!.point.y).toBeCloseTo(0, 0);
    expect(closest!.pathParam).toBeCloseTo(0.4, 1);
  });
});

describe('directionFromAngle', () => {
  it('maps cardinal angles', () => {
    expect(directionFromAngle(0)).toBe('right');
    expect(directionFromAngle(Math.PI / 2)).toBe('bottom');
    expect(directionFromAngle(Math.PI)).toBe('left');
    expect(directionFromAngle(-Math.PI / 2)).toBe('top');
  });
});
