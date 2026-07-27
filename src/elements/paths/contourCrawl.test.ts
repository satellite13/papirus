import { describe, it, expect } from 'vitest';
import { PolylinePathStrategy } from './PolylinePathStrategy';
import { preserveFacingGap, routeOrthogonalAround } from './routeOrthogonalAround';

describe('no contour crawl under Business Process', () => {
  const s = new PolylinePathStrategy();

  const pad = (
    n: { id: string; x: number; y: number; width: number; height: number },
    role?: 'source' | 'target' | 'other',
    amount = 4
  ) => ({
    id: n.id,
    x: n.x - amount,
    y: n.y - amount,
    width: n.width + amount * 2,
    height: n.height + amount * 2,
    role: role ?? ('other' as const),
  });

  /** Long horizontals must not sit on the endEntry stub line under BP. */
  function assertNotOnEntryStub(
    path: { x: number; y: number }[],
    toY: number,
    exitDistance = 20
  ): void {
    const stubY = toY + exitDistance;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1]!;
      const b = path[i]!;
      if (Math.abs(a.y - b.y) < 0.5 && Math.abs(a.x - b.x) > 40) {
        expect(Math.abs(a.y - stubY), `stub crawl at y=${a.y}`).toBeGreaterThan(8);
      }
    }
  }

  function assertInGapBand(
    path: { x: number; y: number }[],
    gapLow: number,
    gapHigh: number
  ): void {
    const midLow = gapLow + (gapHigh - gapLow) * 0.25;
    const midHigh = gapLow + (gapHigh - gapLow) * 0.75;
    expect(
      path.some((p) => p.y >= midLow && p.y <= midHigh),
      `expected mid-gap waypoint in [${midLow}, ${midHigh}], path=${path.map((p) => `${p.x},${p.y}`).join('→')}`
    ).toBe(true);
  }

  it('top→bottom with parent uses mid-gap, not endEntry under BP', () => {
    const bp = { id: 'bp', x: 40, y: 40, width: 400, height: 50 };
    const product = { id: 'product', x: 160, y: 200, width: 220, height: 160 };
    const component = { id: 'comp', x: 200, y: 240, width: 140, height: 60 };
    const path = routeOrthogonalAround({
      from: { x: 270, y: 240 },
      to: { x: 180, y: 90 },
      fromDir: 'top',
      toDir: 'bottom',
      parent: product,
      source: component,
      target: bp,
      margin: 4,
      exitDistance: 20,
    });
    assertNotOnEntryStub(path, 90);
    assertInGapBand(path, bp.y + bp.height, product.y);
  });

  it('PolylinePathStrategy Component→BP does not crawl BP bottom stub', () => {
    const bp = { id: 'bp', x: 40, y: 40, width: 400, height: 50 };
    const product = { id: 'product', x: 160, y: 200, width: 220, height: 160 };
    const component = { id: 'comp', x: 200, y: 240, width: 140, height: 60 };
    const path = s.calculatePath({ x: 300, y: 240 }, { x: 120, y: 90 }, 'top', 'bottom', {
      obstacles: [pad(bp, 'target'), pad(product), pad(component, 'source')],
    });
    assertNotOnEntryStub(path, 90);
    assertInGapBand(path, bp.y + bp.height, product.y);
  });

  it('warchi: Digital Product (right) → BP uses mid-gap, not contour stub', () => {
    // Screenshot layout: wide BP above, Digital Product below-left, right exit + bottom entry.
    const bp = { id: 'bp', x: 80, y: 40, width: 560, height: 48 };
    const product = { id: 'product', x: 120, y: 180, width: 280, height: 160 };
    const from = { x: product.x + product.width, y: product.y + product.height / 2 }; // right side
    const to = { x: 400, y: bp.y + bp.height }; // BP bottom port toward product center-right
    const path = s.calculatePath(from, to, 'right', 'bottom', {
      obstacles: [pad(bp, 'target', 8), pad(product, 'source', 8)],
    });
    assertNotOnEntryStub(path, to.y);
    assertInGapBand(path, bp.y + bp.height, product.y);
  });

  it('warchi: Digital Product (top) → BP uses mid-gap', () => {
    const bp = { id: 'bp', x: 80, y: 40, width: 560, height: 48 };
    const product = { id: 'product', x: 120, y: 180, width: 280, height: 160 };
    const from = { x: product.x + product.width / 2, y: product.y };
    const to = { x: 200, y: bp.y + bp.height };
    const path = s.calculatePath(from, to, 'top', 'bottom', {
      obstacles: [pad(bp, 'target', 8), pad(product, 'source', 8)],
    });
    assertNotOnEntryStub(path, to.y);
    assertInGapBand(path, bp.y + bp.height, product.y);
  });

  it('left→bottom with tight BP/Product gap uses gap corridor, not stub line', () => {
    const tightBp = { id: 'bp', x: 40, y: 40, width: 520, height: 48 };
    const tightProduct = { id: 'product', x: 60, y: 100, width: 480, height: 320 };
    const tightComp = { id: 'comp', x: 280, y: 220, width: 140, height: 70 };
    const path = s.calculatePath({ x: 280, y: 255 }, { x: 100, y: 88 }, 'left', 'bottom', {
      obstacles: [
        pad(tightBp, 'target', 8),
        pad(tightProduct, undefined, 8),
        pad(tightComp, 'source', 8),
      ],
    });
    assertNotOnEntryStub(path, 88);
    // Horizontal jog should sit in the visual gutter, not on the +20 stub.
    assertInGapBand(path, tightBp.y + tightBp.height, tightProduct.y);
  });

  it('preserveFacingGap reopens a padded stack corridor', () => {
    const rawAbove = { id: 'a', x: 40, y: 40, width: 200, height: 40 };
    const rawBelow = { id: 'b', x: 40, y: 120, width: 200, height: 80 };
    const [a2, b2] = preserveFacingGap(
      {
        x: rawAbove.x - 12,
        y: rawAbove.y - 12,
        width: rawAbove.width + 24,
        height: rawAbove.height + 24,
      },
      {
        x: rawBelow.x - 12,
        y: rawBelow.y - 12,
        width: rawBelow.width + 24,
        height: rawBelow.height + 24,
      },
      rawAbove,
      rawBelow
    );
    expect(a2.y + a2.height).toBeLessThan(b2.y);
    expect(b2.y - (a2.y + a2.height)).toBeGreaterThanOrEqual(2);
  });
});
