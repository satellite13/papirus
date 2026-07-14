import { describe, expect, it } from 'vitest';
import { isSvgMarkup, isSvgUrl, svgToDataUrl, tintSvg } from './svgTint';

describe('svgTint', () => {
  it('detects inline SVG markup', () => {
    expect(isSvgMarkup('  <svg viewBox="0 0 1 1"></svg>')).toBe(true);
    expect(isSvgMarkup('<div><svg></svg></div>')).toBe(true);
    expect(isSvgMarkup('/icons/item.svg')).toBe(false);
  });

  it('detects SVG URLs including query strings', () => {
    expect(isSvgUrl('/icons/item.svg?version=1')).toBe(true);
    expect(isSvgUrl('https://example.test/item.png')).toBe(false);
  });

  it('encodes SVG markup as a compact data URL', () => {
    const result = svgToDataUrl('<svg>\n\t<path /></svg>');

    expect(result).toMatch(/^data:image\/svg\+xml;utf8,/);
    expect(result).not.toContain('%0A');
    expect(result).not.toContain('%09');
  });

  it('returns markup unchanged when no tint is requested', () => {
    const svg = '<svg><path fill="red"/></svg>';
    expect(tintSvg(svg)).toBe(svg);
  });

  it('tints attributes and inline styles while preserving none', () => {
    const result = tintSvg(
      '<svg><path stroke="red" fill="none" style="stroke:blue;fill:green"/></svg>',
      '#111111',
      '#eeeeee'
    );

    expect(result).toContain('stroke="#111111"');
    expect(result).toContain('fill="none"');
    expect(result).toContain('stroke:#111111');
    expect(result).toContain('fill:#eeeeee');
  });
});
