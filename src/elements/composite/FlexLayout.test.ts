import { describe, it, expect } from 'vitest';
import { flexLayout, type FlexChild, type FlexConfig } from './FlexLayout';
import { normalizeSides } from './CComponent';

function child(
  w: number,
  h: number,
  overrides: Partial<FlexChild> = {}
): FlexChild {
  return {
    measure: { width: w, height: h },
    minSize: { width: 0, height: 0 },
    flexGrow: 0,
    flexShrink: 1,
    flexBasis: 'auto',
    alignSelf: 'auto',
    margin: normalizeSides(0),
    ...overrides,
  };
}

const baseConfig: FlexConfig = {
  direction: 'row',
  justifyContent: 'start',
  alignItems: 'start',
  gap: 0,
  padding: 0,
};

describe('FlexLayout', () => {
  describe('empty children', () => {
    it('returns empty childBounds and padding-only contentSize', () => {
      const result = flexLayout({ width: 200, height: 100 }, baseConfig, []);
      expect(result.childBounds).toEqual([]);
      expect(result.contentSize).toEqual({ width: 0, height: 0 });
    });

    it('includes padding in contentSize when no children', () => {
      const result = flexLayout(
        { width: 200, height: 100 },
        { ...baseConfig, padding: 10 },
        []
      );
      expect(result.contentSize).toEqual({ width: 20, height: 20 });
    });
  });

  describe('row direction', () => {
    it('places children side by side from start', () => {
      const result = flexLayout({ width: 300, height: 100 }, baseConfig, [
        child(50, 30),
        child(80, 40),
      ]);
      expect(result.childBounds[0]).toEqual({ x: 0, y: 0, width: 50, height: 30 });
      expect(result.childBounds[1]).toEqual({ x: 50, y: 0, width: 80, height: 40 });
    });

    it('respects gap between children', () => {
      const result = flexLayout(
        { width: 300, height: 100 },
        { ...baseConfig, gap: 10 },
        [child(50, 30), child(80, 40)]
      );
      expect(result.childBounds[0]).toEqual({ x: 0, y: 0, width: 50, height: 30 });
      expect(result.childBounds[1]).toEqual({ x: 60, y: 0, width: 80, height: 40 });
    });

    it('respects padding', () => {
      const result = flexLayout(
        { width: 300, height: 100 },
        { ...baseConfig, padding: { top: 5, right: 10, bottom: 15, left: 20 } },
        [child(50, 30)]
      );
      expect(result.childBounds[0]).toEqual({ x: 20, y: 5, width: 50, height: 30 });
    });
  });

  describe('column direction', () => {
    it('places children stacked vertically', () => {
      const config = { ...baseConfig, direction: 'column' as const };
      const result = flexLayout({ width: 200, height: 300 }, config, [
        child(50, 30),
        child(80, 40),
      ]);
      expect(result.childBounds[0]).toEqual({ x: 0, y: 0, width: 50, height: 30 });
      expect(result.childBounds[1]).toEqual({ x: 0, y: 30, width: 80, height: 40 });
    });

    it('respects gap in column', () => {
      const config = { ...baseConfig, direction: 'column' as const, gap: 8 };
      const result = flexLayout({ width: 200, height: 300 }, config, [
        child(50, 30),
        child(80, 40),
      ]);
      expect(result.childBounds[0]).toEqual({ x: 0, y: 0, width: 50, height: 30 });
      expect(result.childBounds[1]).toEqual({ x: 0, y: 38, width: 80, height: 40 });
    });
  });

  describe('justifyContent', () => {
    const children = [child(50, 30), child(50, 30)];

    it('start — children at the beginning', () => {
      const result = flexLayout(
        { width: 200, height: 100 },
        { ...baseConfig, justifyContent: 'start' },
        children
      );
      expect(result.childBounds[0]!.x).toBe(0);
      expect(result.childBounds[1]!.x).toBe(50);
    });

    it('center — children centered', () => {
      const result = flexLayout(
        { width: 200, height: 100 },
        { ...baseConfig, justifyContent: 'center' },
        children
      );
      // Free space = 200 - 100 = 100, offset = 50
      expect(result.childBounds[0]!.x).toBe(50);
      expect(result.childBounds[1]!.x).toBe(100);
    });

    it('end — children at the end', () => {
      const result = flexLayout(
        { width: 200, height: 100 },
        { ...baseConfig, justifyContent: 'end' },
        children
      );
      expect(result.childBounds[0]!.x).toBe(100);
      expect(result.childBounds[1]!.x).toBe(150);
    });

    it('space-between — children at edges with space between', () => {
      const result = flexLayout(
        { width: 200, height: 100 },
        { ...baseConfig, justifyContent: 'space-between' },
        children
      );
      expect(result.childBounds[0]!.x).toBe(0);
      expect(result.childBounds[1]!.x).toBe(150);
    });

    it('space-between with single child — placed at start', () => {
      const result = flexLayout(
        { width: 200, height: 100 },
        { ...baseConfig, justifyContent: 'space-between' },
        [child(50, 30)]
      );
      expect(result.childBounds[0]!.x).toBe(0);
    });

    it('space-around — equal space around each child', () => {
      const result = flexLayout(
        { width: 200, height: 100 },
        { ...baseConfig, justifyContent: 'space-around' },
        children
      );
      // Free = 100, each around = 50, first offset = 25
      expect(result.childBounds[0]!.x).toBe(25);
      expect(result.childBounds[1]!.x).toBe(125);
    });
  });

  describe('alignItems', () => {
    it('start — children at cross start', () => {
      const result = flexLayout(
        { width: 200, height: 100 },
        { ...baseConfig, alignItems: 'start' },
        [child(50, 30)]
      );
      expect(result.childBounds[0]!.y).toBe(0);
      expect(result.childBounds[0]!.height).toBe(30);
    });

    it('center — children centered on cross axis', () => {
      const result = flexLayout(
        { width: 200, height: 100 },
        { ...baseConfig, alignItems: 'center' },
        [child(50, 30)]
      );
      expect(result.childBounds[0]!.y).toBe(35);
      expect(result.childBounds[0]!.height).toBe(30);
    });

    it('end — children at cross end', () => {
      const result = flexLayout(
        { width: 200, height: 100 },
        { ...baseConfig, alignItems: 'end' },
        [child(50, 30)]
      );
      expect(result.childBounds[0]!.y).toBe(70);
      expect(result.childBounds[0]!.height).toBe(30);
    });

    it('stretch — children fill cross axis', () => {
      const result = flexLayout(
        { width: 200, height: 100 },
        { ...baseConfig, alignItems: 'stretch' },
        [child(50, 30)]
      );
      expect(result.childBounds[0]!.y).toBe(0);
      expect(result.childBounds[0]!.height).toBe(100);
    });
  });

  describe('alignSelf', () => {
    it('overrides alignItems for individual child', () => {
      const result = flexLayout(
        { width: 200, height: 100 },
        { ...baseConfig, alignItems: 'start' },
        [
          child(50, 30, { alignSelf: 'end' }),
          child(50, 30),
        ]
      );
      expect(result.childBounds[0]!.y).toBe(70); // end
      expect(result.childBounds[1]!.y).toBe(0);  // start (from alignItems)
    });

    it('auto uses container alignItems', () => {
      const result = flexLayout(
        { width: 200, height: 100 },
        { ...baseConfig, alignItems: 'center' },
        [child(50, 30, { alignSelf: 'auto' })]
      );
      expect(result.childBounds[0]!.y).toBe(35);
    });
  });

  describe('flexGrow', () => {
    it('distributes extra space proportionally', () => {
      const result = flexLayout({ width: 300, height: 100 }, baseConfig, [
        child(50, 30, { flexGrow: 1 }),
        child(50, 30, { flexGrow: 2 }),
      ]);
      // Extra = 300 - 100 = 200; child0 gets 200/3 ≈ 66.67, child1 gets 400/3 ≈ 133.33
      expect(result.childBounds[0]!.width).toBeCloseTo(50 + 200 / 3, 5);
      expect(result.childBounds[1]!.width).toBeCloseTo(50 + 400 / 3, 5);
    });

    it('does nothing when all flexGrow are 0', () => {
      const result = flexLayout({ width: 300, height: 100 }, baseConfig, [
        child(50, 30),
        child(50, 30),
      ]);
      expect(result.childBounds[0]!.width).toBe(50);
      expect(result.childBounds[1]!.width).toBe(50);
    });
  });

  describe('flexShrink', () => {
    it('shrinks proportionally when content overflows', () => {
      const result = flexLayout({ width: 100, height: 50 }, baseConfig, [
        child(80, 30, { flexShrink: 1 }),
        child(80, 30, { flexShrink: 1 }),
      ]);
      // Total = 160, available = 100, deficit = 60
      // Both have same shrink weight (1*80 each), so split evenly: each shrinks 30
      expect(result.childBounds[0]!.width).toBe(50);
      expect(result.childBounds[1]!.width).toBe(50);
    });

    it('clamps to minSize when shrinking', () => {
      const result = flexLayout({ width: 100, height: 50 }, baseConfig, [
        child(80, 30, { flexShrink: 1, minSize: { width: 70, height: 0 } }),
        child(80, 30, { flexShrink: 1 }),
      ]);
      // child0 can only shrink to 70, so child1 absorbs the remaining deficit
      expect(result.childBounds[0]!.width).toBe(70);
      expect(result.childBounds[1]!.width).toBe(30);
    });

    it('iteratively redistributes shrink after multiple items reach minSize', () => {
      const result = flexLayout({ width: 180, height: 50 }, baseConfig, [
        child(100, 30, { minSize: { width: 90, height: 0 } }),
        child(100, 30, { minSize: { width: 70, height: 0 } }),
        child(100, 30),
      ]);

      expect(result.childBounds[0]!.width).toBe(90);
      expect(result.childBounds[1]!.width).toBe(70);
      expect(result.childBounds[2]!.width).toBe(20);
    });
  });

  describe('flexBasis', () => {
    it('uses explicit flexBasis instead of measured size', () => {
      const result = flexLayout({ width: 300, height: 100 }, baseConfig, [
        child(50, 30, { flexBasis: 100 }),
      ]);
      expect(result.childBounds[0]!.width).toBe(100);
    });

    it('auto uses measured size', () => {
      const result = flexLayout({ width: 300, height: 100 }, baseConfig, [
        child(50, 30, { flexBasis: 'auto' }),
      ]);
      expect(result.childBounds[0]!.width).toBe(50);
    });
  });

  describe('margin', () => {
    it('applies per-child margin in row', () => {
      const result = flexLayout({ width: 300, height: 100 }, baseConfig, [
        child(50, 30, { margin: normalizeSides({ left: 10, right: 5 }) }),
        child(50, 30),
      ]);
      expect(result.childBounds[0]!.x).toBe(10); // left margin
      expect(result.childBounds[1]!.x).toBe(65); // 10 + 50 + 5
    });

    it('applies cross-axis margin', () => {
      const result = flexLayout(
        { width: 300, height: 100 },
        { ...baseConfig, alignItems: 'start' },
        [child(50, 30, { margin: normalizeSides({ top: 15 }) })]
      );
      expect(result.childBounds[0]!.y).toBe(15);
    });
  });

  describe('contentSize', () => {
    it('reflects actual content extent in row', () => {
      const result = flexLayout(
        { width: 300, height: 100 },
        { ...baseConfig, padding: 10 },
        [child(50, 30), child(80, 40)]
      );
      expect(result.contentSize.width).toBe(10 + 50 + 80 + 10);
      expect(result.contentSize.height).toBe(10 + 40 + 10);
    });

    it('reflects actual content extent in column', () => {
      const result = flexLayout(
        { width: 200, height: 300 },
        { ...baseConfig, direction: 'column', padding: 5, gap: 10 },
        [child(50, 30), child(80, 40)]
      );
      expect(result.contentSize.width).toBe(5 + 80 + 5);
      expect(result.contentSize.height).toBe(5 + 30 + 10 + 40 + 5);
    });
  });

  describe('single child', () => {
    it('handles single child correctly', () => {
      const result = flexLayout({ width: 200, height: 100 }, baseConfig, [
        child(50, 30),
      ]);
      expect(result.childBounds).toHaveLength(1);
      expect(result.childBounds[0]).toEqual({ x: 0, y: 0, width: 50, height: 30 });
    });
  });

  describe('zero-size container', () => {
    it('handles zero container without crashing', () => {
      const result = flexLayout({ width: 0, height: 0 }, baseConfig, [
        child(50, 30),
      ]);
      expect(result.childBounds).toHaveLength(1);
      // Child shrinks to 0 since minSize is 0 and container has no space
      expect(result.childBounds[0]!.width).toBe(0);
    });
  });
});
