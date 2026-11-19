import { describe, it, expect } from 'vitest';
import { DEFAULT_END_STUB } from '@/constants';
import { clampFacingExitEntry, endStubMeet } from './routeOrthogonalAround';
import { PolylinePathStrategy } from './PolylinePathStrategy';
import { crosses, routeScenario, scenarios } from '@/test/routingScenarios';

type P = { x: number; y: number };

function lastSegment(path: P[]): { len: number; axis: 'h' | 'v' | 'diag' } {
  const a = path[path.length - 2]!;
  const b = path[path.length - 1]!;
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return { len: dx + dy, axis: dy < 0.001 ? 'h' : dx < 0.001 ? 'v' : 'diag' };
}

const axisOfSide = (side: string): 'h' | 'v' =>
  side === 'left' || side === 'right' ? 'h' : 'v';

describe('end stub (routeOrthogonalAround)', () => {
  for (const [name, sc] of Object.entries(scenarios)) {
    it(`${name}: last segment is normal to the entry side and ≥ endStubLength`, () => {
      const seg = lastSegment(routeScenario(sc));
      expect(seg.axis).toBe(axisOfSide(sc.toDir));
      expect(seg.len).toBeGreaterThanOrEqual(DEFAULT_END_STUB - 0.001);
    });
  }

  it('exactStub: turn before the target leaves exactly endStubLength', () => {
    expect(lastSegment(routeScenario(scenarios.exactStub)).len).toBeCloseTo(16, 3);
    expect(lastSegment(routeScenario(scenarios.exactStub, 18)).len).toBeCloseTo(18, 3);
  });

  it('rightToLeftBlocked: sibling in the mid-gap keeps a normal end stub, no crossings', () => {
    const sc = scenarios.rightToLeftBlocked;
    const path = routeScenario(sc);
    const seg = lastSegment(path);
    expect(seg.axis).toBe(axisOfSide(sc.toDir));
    expect(seg.len, JSON.stringify(path)).toBeGreaterThanOrEqual(DEFAULT_END_STUB - 0.001);
    for (const r of [sc.a, sc.b, ...sc.others]) {
      expect(crosses(path, r), `crosses ${r.id}: ${JSON.stringify(path)}`).toBe(false);
    }
  });

  it('sibling in the mid-gap up to the stub line: fallback entry leaves exactly endStubLength', () => {
    // c padded + margin ends at x = 484 = to.x − 16: only the end stub fits beside it.
    const sc = {
      ...scenarios.rightToLeftBlocked,
      others: [{ id: 'c', x: 300, y: 90, width: 176, height: 80 }],
    };
    const path = routeScenario(sc);
    const seg = lastSegment(path);
    expect(seg.axis).toBe(axisOfSide(sc.toDir));
    expect(seg.len, JSON.stringify(path)).toBeCloseTo(DEFAULT_END_STUB, 3);
    for (const r of [sc.a, sc.b, ...sc.others]) {
      expect(crosses(path, r), `crosses ${r.id}: ${JSON.stringify(path)}`).toBe(false);
    }
  });
});

describe('endStubMeet / clampFacingExitEntry', () => {
  it('keeps the mid-gap when it leaves enough stub', () => {
    expect(endStubMeet(0, 40, 16)).toBe(20);
  });

  it('moves the meet toward the source to keep the end stub', () => {
    expect(endStubMeet(160, 185, 16)).toBe(169);
    expect(endStubMeet(185, 160, 16)).toBe(176);
  });

  it('falls back to the middle when the gap is too small', () => {
    expect(endStubMeet(160, 180, 16)).toBe(170);
  });

  it('clampFacingExitEntry uses endStubMeet', () => {
    const clamped = clampFacingExitEntry(
      { x: 160, y: 160 },
      { x: 180, y: 185 },
      'bottom',
      'top',
      { x: 160, y: 180 },
      { x: 180, y: 169 }
    );
    expect(clamped.startExit.y).toBe(169);
    expect(clamped.endEntry.y).toBe(169);
    const custom = clampFacingExitEntry(
      { x: 160, y: 160 },
      { x: 180, y: 185 },
      'bottom',
      'top',
      { x: 160, y: 180 },
      { x: 180, y: 175 },
      10
    );
    // gap 25: mid-gap already leaves 12.5 ≥ 10
    expect(custom.endEntry.y).toBe(172.5);
  });

  it('close facing nodes keep the end stub when the gap allows', () => {
    const s = new PolylinePathStrategy();
    const start = { x: 100, y: 100, width: 120, height: 60 };
    for (const gap of [24, 30, 40]) {
      const process = { x: 110, y: 160 + gap, width: 140, height: 64 };
      const pad = (r: typeof start, role: 'source' | 'target') => ({
        x: r.x - 4,
        y: r.y - 4,
        width: r.width + 8,
        height: r.height + 8,
        role,
      });
      const path = s.calculatePath({ x: 160, y: 160 }, { x: 180, y: process.y }, 'bottom', 'top', {
        obstacles: [pad(start, 'source'), pad(process, 'target')],
      });
      const seg = lastSegment(path);
      expect(seg.axis, `gap ${gap}`).toBe('v');
      expect(seg.len, `gap ${gap}: ${JSON.stringify(path)}`).toBeGreaterThanOrEqual(16 - 0.001);
    }
  });
});
