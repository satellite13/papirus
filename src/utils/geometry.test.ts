import { describe, it, expect } from 'vitest';
import {
  distance,
  mergeBounds,
  clonePoints,
  pointInRect,
  rectsIntersect,
  rectUnion,
  snapToGrid,
  snapPointToGrid,
} from './geometry';

describe('geometry', () => {
  describe('distance', () => {
    it('returns 0 for same point', () => {
      expect(distance({ x: 10, y: 20 }, { x: 10, y: 20 })).toBe(0);
    });

    it('returns horizontal distance', () => {
      expect(distance({ x: 0, y: 0 }, { x: 100, y: 0 })).toBe(100);
    });

    it('returns diagonal distance', () => {
      expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    });
  });

  describe('mergeBounds', () => {
    it('returns null for empty iterable', () => {
      expect(mergeBounds([])).toBeNull();
      expect(mergeBounds(new Set())).toBeNull();
    });

    it('returns single bounds unchanged', () => {
      const b = { x: 10, y: 20, width: 50, height: 30 };
      expect(mergeBounds([b])).toEqual({ x: 10, y: 20, width: 50, height: 30 });
    });

    it('merges two non-overlapping bounds', () => {
      const a = { x: 0, y: 0, width: 20, height: 20 };
      const b = { x: 50, y: 50, width: 30, height: 40 };
      expect(mergeBounds([a, b])).toEqual({
        x: 0,
        y: 0,
        width: 80,
        height: 90,
      });
    });

    it('merges overlapping bounds', () => {
      const a = { x: 10, y: 10, width: 50, height: 50 };
      const b = { x: 40, y: 40, width: 50, height: 50 };
      expect(mergeBounds([a, b])).toEqual({
        x: 10,
        y: 10,
        width: 80,
        height: 80,
      });
    });

    it('handles bounds with negative coordinates', () => {
      const a = { x: -10, y: 5, width: 20, height: 10 };
      const b = { x: 0, y: 0, width: 10, height: 10 };
      expect(mergeBounds([a, b])).toEqual({
        x: -10,
        y: 0,
        width: 20,
        height: 15,
      });
    });
  });

  describe('clonePoints', () => {
    it('returns new array with copied points', () => {
      const points = [{ x: 1, y: 2 }, { x: 3, y: 4 }];
      const cloned = clonePoints(points);
      expect(cloned).not.toBe(points);
      expect(cloned).toEqual(points);
      expect(cloned[0]).not.toBe(points[0]);
      expect(cloned[0]).toEqual(points[0]);
    });

    it('returns empty array for empty input', () => {
      expect(clonePoints([])).toEqual([]);
    });
  });

  describe('pointInRect', () => {
    it('returns true for point inside', () => {
      expect(pointInRect({ x: 50, y: 50 }, { x: 0, y: 0, width: 100, height: 100 })).toBe(true);
    });

    it('returns false for point outside', () => {
      expect(pointInRect({ x: 150, y: 50 }, { x: 0, y: 0, width: 100, height: 100 })).toBe(false);
    });

    it('returns true for point on edge', () => {
      expect(pointInRect({ x: 0, y: 0 }, { x: 0, y: 0, width: 100, height: 100 })).toBe(true);
    });
  });

  describe('rectsIntersect', () => {
    it('returns true for overlapping rects', () => {
      expect(
        rectsIntersect(
          { x: 0, y: 0, width: 50, height: 50 },
          { x: 25, y: 25, width: 50, height: 50 }
        )
      ).toBe(true);
    });

    it('returns false for non-overlapping rects', () => {
      expect(
        rectsIntersect(
          { x: 0, y: 0, width: 50, height: 50 },
          { x: 100, y: 100, width: 50, height: 50 }
        )
      ).toBe(false);
    });
  });

  describe('rectUnion', () => {
    it('returns bounding box of two rects', () => {
      expect(
        rectUnion(
          { x: 0, y: 0, width: 20, height: 20 },
          { x: 50, y: 50, width: 30, height: 30 }
        )
      ).toEqual({ x: 0, y: 0, width: 80, height: 80 });
    });
  });

  describe('snapToGrid', () => {
    it('snaps to grid', () => {
      expect(snapToGrid(12, 10)).toBe(10);
      expect(snapToGrid(15, 10)).toBe(20);
    });
  });

  describe('snapPointToGrid', () => {
    it('snaps both coordinates', () => {
      expect(snapPointToGrid({ x: 12, y: 18 }, 10)).toEqual({ x: 10, y: 20 });
    });
  });
});
