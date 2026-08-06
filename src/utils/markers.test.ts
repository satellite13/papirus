import { describe, expect, it } from 'vitest';
import { ARROW_ANGLE } from '@/constants';
import {
  calculateStealthMarkerPoints,
  generateSvgMarker,
  getMarkerLength,
} from '@/utils/markers';

describe('stealth marker', () => {
  it('builds a barbed quad with tip at to and concave heel on centerline', () => {
    const to = { x: 100, y: 50 };
    const angle = 0; // pointing +x
    const size = 12;
    const p = calculateStealthMarkerPoints(to, angle, size);

    expect(p.tip).toEqual(to);
    // Outer barbs match arrow wings
    expect(p.leftOuter.x).toBeCloseTo(to.x - size * Math.cos(angle - ARROW_ANGLE), 5);
    expect(p.rightOuter.x).toBeCloseTo(to.x - size * Math.cos(angle + ARROW_ANGLE), 5);
    // Heel on centerline, closer to tip than outer barbs (concave notch)
    expect(p.heel.y).toBeCloseTo(to.y, 5);
    const outerDepth = Math.max(to.x - p.leftOuter.x, to.x - p.rightOuter.x);
    const heelDepth = to.x - p.heel.x;
    expect(heelDepth).toBeLessThan(outerDepth);
    expect(heelDepth).toBeGreaterThan(0);
  });

  it('shortens the edge by arrow-equivalent length', () => {
    const len = getMarkerLength({ type: 'stealth', size: 12 });
    expect(len).toBeCloseTo(12 * Math.cos(ARROW_ANGLE), 5);
  });

  it('generates a filled closed SVG path', () => {
    const to = { x: 100, y: 0 };
    const svg = generateSvgMarker(
      { type: 'stealth', size: 12, fillColor: '#000', fillOpacity: 1 },
      { x: 0, y: 0 },
      to,
      '#000'
    );
    const p = calculateStealthMarkerPoints(to, 0, 12);
    expect(svg).toMatch(/^<path /);
    expect(svg).toContain(' Z"');
    expect(svg).toContain('fill="#000"');
    expect(svg).not.toContain('fill="none"');
    // Quad: tip→outer→heel→outer (3 L segments); arrow fallback has only 2
    expect((svg.match(/ L /g) ?? []).length).toBe(3);
    expect(svg).toContain(`${p.heel.x} ${p.heel.y}`);
  });
});
