import { describe, expect, it } from 'vitest';
import {
  directionToVector,
  getDirectionFromOutlineParam,
  isHorizontal,
  isOppositeDirections,
  isVertical,
} from './direction';

describe('direction utilities', () => {
  it.each([
    [0, 'top'],
    [0.24, 'top'],
    [0.25, 'right'],
    [0.5, 'bottom'],
    [0.75, 'left'],
    [-0.25, 'left'],
    [1.25, 'right'],
  ] as const)('maps outline parameter %s to %s (equal-quarter fallback)', (param, expected) => {
    expect(getDirectionFromOutlineParam(param)).toBe(expected);
  });

  it('uses real perimeter fractions for wide/short bounds', () => {
    // 400×50 → peri 900; bottom is param [0.5 .. ~0.944]
    const wide = { width: 400, height: 50 };
    expect(getDirectionFromOutlineParam(0.5, wide)).toBe('bottom');
    expect(getDirectionFromOutlineParam(0.8, wide)).toBe('bottom');
    expect(getDirectionFromOutlineParam(0.94, wide)).toBe('bottom');
    expect(getDirectionFromOutlineParam(0.95, wide)).toBe('left');
    // Equal-quarter fallback wrongly called this "left"
    expect(getDirectionFromOutlineParam(0.8)).toBe('left');
  });

  it('classifies horizontal and vertical directions', () => {
    expect(isHorizontal('left')).toBe(true);
    expect(isHorizontal('right')).toBe(true);
    expect(isHorizontal('top')).toBe(false);
    expect(isVertical('top')).toBe(true);
    expect(isVertical('bottom')).toBe(true);
    expect(isVertical('left')).toBe(false);
  });

  it('recognizes every opposite direction pair', () => {
    expect(isOppositeDirections('left', 'right')).toBe(true);
    expect(isOppositeDirections('right', 'left')).toBe(true);
    expect(isOppositeDirections('top', 'bottom')).toBe(true);
    expect(isOppositeDirections('bottom', 'top')).toBe(true);
    expect(isOppositeDirections('left', 'top')).toBe(false);
  });

  it.each([
    ['top', { x: 0, y: -1 }],
    ['bottom', { x: 0, y: 1 }],
    ['left', { x: -1, y: 0 }],
    ['right', { x: 1, y: 0 }],
    [undefined, { x: 0, y: 0 }],
  ] as const)('converts %s to a unit vector', (direction, expected) => {
    expect(directionToVector(direction)).toEqual(expected);
  });
});
