import { describe, expect, it } from 'vitest';
import { getOutlineConnectHandle, nearestOutlineSide } from './outlineConnectHandle';

const bounds = { x: 50, y: 80, width: 60, height: 40 };
const large = { x: 0, y: 0, width: 400, height: 200 };

describe('outlineConnectHandle', () => {
  it('picks the nearest side from the pointer', () => {
    expect(nearestOutlineSide(bounds, { x: 200, y: 100 })).toBe('right');
    expect(nearestOutlineSide(bounds, { x: 10, y: 100 })).toBe('left');
    expect(nearestOutlineSide(bounds, { x: 80, y: 10 })).toBe('top');
    expect(nearestOutlineSide(bounds, { x: 80, y: 200 })).toBe('bottom');
  });

  it('places the handle at the closest outline point, not the side midpoint', () => {
    const nearTopLeft = getOutlineConnectHandle(large, { x: 40, y: 20 }, 0);
    expect(nearTopLeft.side).toBe('top');
    expect(nearTopLeft.handle).toEqual({ x: 40, y: 0 });
  });

  it('keeps the previous side near a corner until the other side is clearly closer', () => {
    const pointer = { x: 5, y: 3 };
    const next = getOutlineConnectHandle(large, pointer, 0);
    expect(next.side).toBe('top');

    const sticky = getOutlineConnectHandle(large, pointer, 0, 'left', 8);
    expect(sticky.side).toBe('left');
    expect(sticky.handle).toEqual({ x: 0, y: 3 });
  });
});
