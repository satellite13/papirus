import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CIcon } from './CIcon';
import { mockCanvasContext } from '@/test/testUtils';

// Mock Image for jsdom
class FakeImage {
  src = '';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
}

describe('CIcon', () => {
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    ctx = mockCanvasContext() as unknown as CanvasRenderingContext2D;
    vi.stubGlobal('Image', FakeImage);
  });

  describe('constructor', () => {
    it('sets defaults', () => {
      const icon = new CIcon({ source: '/test.png' });
      expect(icon.source).toBe('/test.png');
      expect(icon.width).toBe(24);
      expect(icon.height).toBe(24);
      expect(icon.backgroundColor).toBeUndefined();
      expect(icon.fillColor).toBeUndefined();
      expect(icon.bindsNotationIcon).toBe(false);
      expect(icon.id).toBeUndefined();
    });

    it('accepts all options', () => {
      const icon = new CIcon({
        id: 'my-icon',
        source: '/icon.svg',
        width: 16,
        height: 16,
        backgroundColor: '#eee',
        fillColor: '#f00',
        bindsNotationIcon: true,
        style: { flexGrow: 1 },
      });
      expect(icon.id).toBe('my-icon');
      expect(icon.width).toBe(16);
      expect(icon.height).toBe(16);
      expect(icon.backgroundColor).toBe('#eee');
      expect(icon.fillColor).toBe('#f00');
      expect(icon.bindsNotationIcon).toBe(true);
      expect(icon.style.flexGrow).toBe(1);
    });

    it('sets visible false via option', () => {
      const icon = new CIcon({ source: '/test.png', visible: false });
      expect(icon.style.visible).toBe(false);
    });
  });

  describe('measure', () => {
    it('returns configured width and height', () => {
      const icon = new CIcon({ source: '/test.png', width: 32, height: 32 });
      expect(icon.measure(ctx)).toEqual({ width: 32, height: 32 });
    });
  });

  describe('render', () => {
    it('draws image when loaded', () => {
      const icon = new CIcon({ source: '/test.png', width: 16, height: 16 });
      // Simulate image load
      (icon as any)._loaded = true;
      icon.render(ctx, { x: 10, y: 20, width: 40, height: 40 });
      expect(ctx.drawImage).toHaveBeenCalled();
    });

    it('does not draw when not loaded', () => {
      const icon = new CIcon({ source: '/test.png' });
      icon.render(ctx, { x: 0, y: 0, width: 40, height: 40 });
      expect(ctx.drawImage).not.toHaveBeenCalled();
    });

    it('draws background rect when backgroundColor is set', () => {
      const icon = new CIcon({
        source: '/test.png',
        backgroundColor: '#eee',
      });
      icon.render(ctx, { x: 0, y: 0, width: 40, height: 40 });
      expect(ctx.fillRect).toHaveBeenCalled();
    });

    it('does not render when visible is false', () => {
      const icon = new CIcon({ source: '/test.png', visible: false });
      (icon as any)._loaded = true;
      icon.render(ctx, { x: 0, y: 0, width: 40, height: 40 });
      expect(ctx.drawImage).not.toHaveBeenCalled();
    });
  });

  describe('hitTest', () => {
    it('returns this when point is inside bounds', () => {
      const icon = new CIcon({ source: '/test.png' });
      const result = icon.hitTest(
        { x: 20, y: 20 },
        { x: 0, y: 0, width: 40, height: 40 }
      );
      expect(result).toBe(icon);
    });

    it('returns null when outside', () => {
      const icon = new CIcon({ source: '/test.png' });
      const result = icon.hitTest(
        { x: 50, y: 50 },
        { x: 0, y: 0, width: 40, height: 40 }
      );
      expect(result).toBeNull();
    });

    it('returns null when not visible', () => {
      const icon = new CIcon({ source: '/test.png', visible: false });
      const result = icon.hitTest(
        { x: 20, y: 20 },
        { x: 0, y: 0, width: 40, height: 40 }
      );
      expect(result).toBeNull();
    });
  });

  describe('serialize', () => {
    it('serializes minimal icon', () => {
      const icon = new CIcon({ source: '/test.png', width: 16, height: 16 });
      const data = icon.serialize();
      expect(data.type).toBe('icon');
      expect(data.source).toBe('/test.png');
      expect(data.width).toBe(16);
      expect(data.height).toBe(16);
      expect(data.backgroundColor).toBeUndefined();
      expect(data.fillColor).toBeUndefined();
      expect(data.bindsNotationIcon).toBeUndefined();
    });

    it('serializes all properties', () => {
      const icon = new CIcon({
        id: 'ic',
        source: '/icon.svg',
        width: 20,
        height: 20,
        backgroundColor: '#eee',
        fillColor: '#f00',
        bindsNotationIcon: true,
        style: { opacity: 0.8 },
      });
      const data = icon.serialize();
      expect(data.id).toBe('ic');
      expect(data.backgroundColor).toBe('#eee');
      expect(data.fillColor).toBe('#f00');
      expect(data.bindsNotationIcon).toBe(true);
      expect(data.style?.opacity).toBe(0.8);
    });
  });

  describe('toSVG', () => {
    it('embeds a tinted inline SVG icon as a data URL', () => {
      const icon = new CIcon({
        source: '<svg xmlns="http://www.w3.org/2000/svg"><path fill="#000"/></svg>',
        fillColor: '#ff0000',
      });

      const result = icon.toSVG({ x: 0, y: 0, width: 24, height: 24 });

      expect(result).toContain('href="data:image/svg+xml')
      expect(result).toContain('%23ff0000')
    })
  })

  describe('toSVG', () => {
    it('generates image element', () => {
      const icon = new CIcon({ source: '/test.png', width: 16, height: 16 });
      const svg = icon.toSVG({ x: 10, y: 20, width: 16, height: 16 });
      expect(svg).toContain('<image');
      expect(svg).toContain('href="/test.png"');
    });

    it('includes background rect when backgroundColor is set', () => {
      const icon = new CIcon({
        source: '/test.png',
        width: 16,
        height: 16,
        backgroundColor: '#eee',
      });
      const svg = icon.toSVG({ x: 0, y: 0, width: 20, height: 20 });
      expect(svg).toContain('<rect');
      expect(svg).toContain('fill="#eee"');
    });

    it('returns empty when not visible', () => {
      const icon = new CIcon({ source: '/test.png', visible: false });
      expect(icon.toSVG({ x: 0, y: 0, width: 20, height: 20 })).toBe('');
    });
  });

  describe('onChange', () => {
    it('fires when source changes', () => {
      const icon = new CIcon({ source: '/a.png' });
      const cb = vi.fn();
      icon.setOnChange(cb);
      icon.source = '/b.png';
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('fires when width changes', () => {
      const icon = new CIcon({ source: '/a.png' });
      const cb = vi.fn();
      icon.setOnChange(cb);
      icon.width = 32;
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('fires when fillColor changes', () => {
      const icon = new CIcon({ source: '/a.png' });
      const cb = vi.fn();
      icon.setOnChange(cb);
      icon.fillColor = '#ff0000';
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('does not fire for same value', () => {
      const icon = new CIcon({ source: '/a.png', width: 24 });
      const cb = vi.fn();
      icon.setOnChange(cb);
      icon.width = 24;
      expect(cb).not.toHaveBeenCalled();
    });
  });
});
