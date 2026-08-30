import { describe, expect, it } from 'vitest';
import {
  MAX_GRID_SCREEN_PX,
  MIN_GRID_SCREEN_PX,
  adaptiveGridStep,
} from './adaptiveGridStep';

describe('adaptiveGridStep', () => {
  it('keeps the base world step while the screen cell stays in range', () => {
    expect(adaptiveGridStep(20, 1)).toBe(20);
    expect(adaptiveGridStep(20, 1.3)).toBe(20);
    expect(20 * 1.3).toBeLessThanOrEqual(MAX_GRID_SCREEN_PX);
  });

  it('doubles the world step when zoom would turn the grid into mush', () => {
    const step = adaptiveGridStep(20, 0.1);
    expect(step).toBe(160);
    expect(step * 0.1).toBeGreaterThanOrEqual(MIN_GRID_SCREEN_PX);
    expect(step * 0.1).toBeLessThanOrEqual(MAX_GRID_SCREEN_PX);
  });

  it('halves the world step when zoom would make huge empty cells', () => {
    const step = adaptiveGridStep(20, 4);
    expect(step).toBe(5);
    expect(step * 4).toBeGreaterThanOrEqual(MIN_GRID_SCREEN_PX);
    expect(step * 4).toBeLessThanOrEqual(MAX_GRID_SCREEN_PX);
  });

  it('resets back near the base screen size after crossing the max cell', () => {
    const before = adaptiveGridStep(20, 1.6);
    const after = adaptiveGridStep(20, 1.61);
    expect(before * 1.6).toBeCloseTo(32);
    expect(before).toBe(20);
    expect(after).toBe(10);
    expect(after * 1.61).toBeGreaterThanOrEqual(MIN_GRID_SCREEN_PX);
    expect(after * 1.61).toBeLessThanOrEqual(MAX_GRID_SCREEN_PX);
  });
});
