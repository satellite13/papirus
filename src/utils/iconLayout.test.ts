import { describe, expect, it } from 'vitest';
import {
  computeIconDrawRect,
  computeIconDrawRectFromOptions,
  getIconBounds,
  getIconBoxSize,
} from './iconLayout';

describe('iconLayout', () => {
  it('includes inset on every side of the icon box', () => {
    expect(getIconBoxSize({ width: 20, height: 10 }, 3)).toEqual({ width: 26, height: 16 });
  });

  it.each([
    ['top', { x: 10, y: 20, width: 100, height: 16 }],
    ['bottom', { x: 10, y: 84, width: 100, height: 16 }],
    ['left', { x: 10, y: 20, width: 26, height: 80 }],
    ['right', { x: 84, y: 20, width: 26, height: 80 }],
    ['top-left', { x: 13, y: 23, width: 26, height: 16 }],
    ['top-right', { x: 81, y: 23, width: 26, height: 16 }],
    ['bottom-left', { x: 13, y: 81, width: 26, height: 16 }],
    ['bottom-right', { x: 81, y: 81, width: 26, height: 16 }],
    ['center', { x: 10, y: 20, width: 100, height: 80 }],
  ] as const)('places an icon at %s', (placement, expected) => {
    expect(
      getIconBounds(
        { x: 10, y: 20, width: 100, height: 80 },
        { width: 26, height: 16 },
        placement,
        3
      )
    ).toEqual(expected);
  });

  it.each([
    ['contain', { x: 5, y: 27.5, width: 90, height: 45 }],
    ['cover', { x: 5, y: 10, width: 90, height: 80 }],
    ['stretch', { x: 5, y: 10, width: 90, height: 80 }],
  ] as const)('computes a centered %s draw rectangle', (fit, expected) => {
    expect(
      computeIconDrawRect(
        { x: 0, y: 5, width: 100, height: 90 },
        { fit, scaleWithBounds: true },
        { width: 40, height: 20 },
        5
      )
    ).toEqual(expected);
  });

  it('uses explicit size for the none fit and clamps it to available bounds', () => {
    expect(
      computeIconDrawRect(
        { x: 0, y: 0, width: 30, height: 20 },
        { fit: 'none', width: 100, height: -5 },
        { width: 10, height: 10 },
        2
      )
    ).toEqual({ x: 2, y: 10, width: 26, height: 0 });
  });

  it('delegates NodeImage options to the draw rectangle calculation', () => {
    expect(
      computeIconDrawRectFromOptions(
        { x: 0, y: 0, width: 20, height: 20 },
        { fit: 'stretch', scaleWithBounds: true },
        { width: 5, height: 5 },
        2
      )
    ).toEqual({ x: 2, y: 2, width: 16, height: 16 });
  });
});
