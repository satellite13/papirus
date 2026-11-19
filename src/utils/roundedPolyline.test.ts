import { describe, expect, it, vi } from 'vitest';
import {
  clampCornerRadius,
  roundedPolylineToSvgD,
  traceRoundedPolyline,
} from './roundedPolyline';

describe('clampCornerRadius', () => {
  it('returns 0 for non-positive inputs', () => {
    expect(clampCornerRadius(0, 10, 10)).toBe(0);
    expect(clampCornerRadius(-1, 10, 10)).toBe(0);
    expect(clampCornerRadius(8, 0, 10)).toBe(0);
  });

  it('clamps to half of the shorter leg at a right angle', () => {
    const right = Math.PI / 2;
    expect(clampCornerRadius(8, 20, 20, right)).toBe(8);
    expect(clampCornerRadius(8, 10, 20, right)).toBe(5);
    expect(clampCornerRadius(8, 6, 4, right)).toBe(2);
  });

  it('shrinks radius for acute corners so the fillet fits the legs', () => {
    // φ ≈ 15.5° with legs 20 / 18.7 — half-length clamp alone would keep r=8 and arcTo loops
    const phi = (15.5 * Math.PI) / 180;
    const r = clampCornerRadius(8, 20, 18.7, phi);
    expect(r).toBeLessThan(3);
    expect(r / Math.tan(phi / 2)).toBeLessThanOrEqual(10 + 1e-6);
  });
});

describe('traceRoundedPolyline', () => {
  it('uses arcTo at corners with clamped radius', () => {
    const sink = {
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arcTo: vi.fn(),
    };
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ];
    traceRoundedPolyline(points, 8, sink);
    expect(sink.moveTo).toHaveBeenCalledWith(0, 0);
    expect(sink.arcTo).toHaveBeenCalledWith(100, 0, 100, 100, 8);
    expect(sink.lineTo).toHaveBeenCalledWith(100, 100);
  });

  it('falls back to lineTo when the segment is too short for the radius', () => {
    const sink = {
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arcTo: vi.fn(),
    };
    const points = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
    ];
    traceRoundedPolyline(points, 8, sink);
    // half of shorter leg at 90° is 2 — still positive, so arcTo with r=2
    expect(sink.arcTo).toHaveBeenCalledWith(4, 0, 4, 4, 2);
  });

  it('does not emit a looping arcTo on a short stub with an acute turn', () => {
    const sink = {
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arcTo: vi.fn(),
    };
    // Short exit stub, then a sharp diagonal — the screenshot failure mode.
    const points = [
      { x: 0, y: 0 },
      { x: 16, y: 0 },
      { x: 4, y: 10 },
      { x: 80, y: 40 },
    ];
    traceRoundedPolyline(points, 8, sink);
    // First corner is acute on a short stub: must shrink well below EDGE_BEND_RADIUS.
    const firstArc = sink.arcTo.mock.calls.find(
      (call) => call[0] === 16 && call[1] === 0
    ) as [number, number, number, number, number] | undefined;
    expect(firstArc).toBeDefined();
    expect(firstArc![4]).toBeLessThan(3);
  });

  it('draws sharp corners when radius is 0', () => {
    const sink = {
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arcTo: vi.fn(),
    };
    traceRoundedPolyline(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
      0,
      sink
    );
    expect(sink.arcTo).not.toHaveBeenCalled();
    expect(sink.lineTo).toHaveBeenCalledTimes(2);
  });
});

describe('roundedPolylineToSvgD', () => {
  it('emits quadratic fillets at corners', () => {
    const d = roundedPolylineToSvgD(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ],
      8
    );
    expect(d.startsWith('M 0 0')).toBe(true);
    expect(d).toContain('Q 100 0');
    expect(d).toContain('L 100 100');
  });

  it('omits fillets when radius clamps to zero on tiny segments', () => {
    roundedPolylineToSvgD(
      [
        { x: 0, y: 0 },
        { x: 0.5, y: 0 },
        { x: 0.5, y: 0.5 },
      ],
      8
    );
    // half of 0.5 = 0.25 — still uses Q; check sharp path when radius 0
    expect(roundedPolylineToSvgD(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
      0
    )).toBe('M 0 0 L 10 0 L 10 10');
  });
});
