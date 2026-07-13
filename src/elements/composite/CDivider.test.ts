import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CDivider } from './CDivider';
import { mockCanvasContext } from '@/test/testUtils';

describe('CDivider', () => {
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    ctx = mockCanvasContext() as unknown as CanvasRenderingContext2D;
  });

  describe('constructor', () => {
    it('uses defaults', () => {
      const d = new CDivider();
      expect(d.color).toBe('#cccccc');
      expect(d.thickness).toBe(1);
      expect(d.type).toBe('divider');
    });

    it('accepts options', () => {
      const d = new CDivider({ id: 'sep', color: '#333', thickness: 2 });
      expect(d.id).toBe('sep');
      expect(d.color).toBe('#333');
      expect(d.thickness).toBe(2);
    });
  });

  describe('measure', () => {
    it('returns thickness as both dimensions', () => {
      const d = new CDivider({ thickness: 2 });
      expect(d.measure(ctx)).toEqual({ width: 2, height: 2 });
    });
  });

  describe('render', () => {
    it('draws a horizontal line when bounds are wider', () => {
      const d = new CDivider({ color: '#333', thickness: 2 });
      d.render(ctx, { x: 10, y: 50, width: 200, height: 2 });
      expect(ctx.beginPath).toHaveBeenCalled();
      expect(ctx.moveTo).toHaveBeenCalled();
      expect(ctx.lineTo).toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalled();
      expect(ctx.strokeStyle).toBe('#333');
      expect(ctx.lineWidth).toBe(2);
    });

    it('draws a vertical line when bounds are taller', () => {
      const d = new CDivider();
      d.render(ctx, { x: 50, y: 10, width: 1, height: 200 });
      expect(ctx.stroke).toHaveBeenCalled();
    });

    it('does not render when visible is false', () => {
      const d = new CDivider({ style: { visible: false } });
      d.render(ctx, { x: 0, y: 0, width: 100, height: 1 });
      expect(ctx.stroke).not.toHaveBeenCalled();
    });
  });

  describe('hitTest', () => {
    it('returns this when point is inside bounds', () => {
      const d = new CDivider();
      expect(d.hitTest({ x: 50, y: 0.5 }, { x: 0, y: 0, width: 100, height: 1 })).toBe(d);
    });

    it('returns null when point is outside bounds', () => {
      const d = new CDivider();
      expect(d.hitTest({ x: 50, y: 2 }, { x: 0, y: 0, width: 100, height: 1 })).toBeNull();
    });

    it('returns null when invisible', () => {
      const d = new CDivider({ style: { visible: false } });
      expect(d.hitTest({ x: 50, y: 0.5 }, { x: 0, y: 0, width: 100, height: 1 })).toBeNull();
    });
  });

  describe('serialize', () => {
    it('serializes minimal divider', () => {
      const d = new CDivider();
      const data = d.serialize();
      expect(data.type).toBe('divider');
      expect(data.color).toBeUndefined(); // default not serialized
      expect(data.thickness).toBeUndefined();
    });

    it('serializes non-default values', () => {
      const d = new CDivider({ id: 'sep', color: '#333', thickness: 2 });
      const data = d.serialize();
      expect(data.id).toBe('sep');
      expect(data.color).toBe('#333');
      expect(data.thickness).toBe(2);
    });
  });

  describe('toSVG', () => {
    it('generates horizontal line for wide bounds', () => {
      const d = new CDivider({ color: '#333', thickness: 1 });
      const svg = d.toSVG({ x: 0, y: 50, width: 200, height: 1 });
      expect(svg).toContain('<line');
      expect(svg).toContain('stroke="#333"');
      expect(svg).toContain('stroke-width="1"');
    });

    it('generates vertical line for tall bounds', () => {
      const d = new CDivider();
      const svg = d.toSVG({ x: 50, y: 0, width: 1, height: 200 });
      expect(svg).toContain('<line');
    });

    it('returns empty when not visible', () => {
      const d = new CDivider({ style: { visible: false } });
      expect(d.toSVG({ x: 0, y: 0, width: 100, height: 1 })).toBe('');
    });
  });

  describe('onChange', () => {
    it('fires when color changes', () => {
      const d = new CDivider();
      const cb = vi.fn();
      d.setOnChange(cb);
      d.color = '#ff0000';
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('fires when thickness changes', () => {
      const d = new CDivider();
      const cb = vi.fn();
      d.setOnChange(cb);
      d.thickness = 3;
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('does not fire for same value', () => {
      const d = new CDivider({ color: '#ccc' });
      const cb = vi.fn();
      d.setOnChange(cb);
      d.color = '#ccc';
      expect(cb).not.toHaveBeenCalled();
    });
  });
});
