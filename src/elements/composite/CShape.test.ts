import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CShape } from './CShape';
import { CContainer } from './CContainer';
import { CText } from './CText';
import { mockCanvasContext } from '@/test/testUtils';

describe('CShape', () => {
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    ctx = mockCanvasContext() as unknown as CanvasRenderingContext2D;
  });

  describe('constructor', () => {
    it('uses defaults', () => {
      const s = new CShape();
      expect(s.borderColor).toBeUndefined();
      expect(s.borderWidth).toBe(0);
      expect(s.backgroundColor).toBeUndefined();
      expect(s.cornerRadius).toBe(0);
      expect(s.content).toBeUndefined();
    });

    it('accepts all options', () => {
      const content = new CContainer({ children: [new CText({ text: 'Hi' })] });
      const s = new CShape({
        id: 'box',
        borderColor: '#333',
        borderWidth: 2,
        backgroundColor: '#f0f0ff',
        cornerRadius: 4,
        padding: 8,
        content,
      });
      expect(s.id).toBe('box');
      expect(s.borderColor).toBe('#333');
      expect(s.borderWidth).toBe(2);
      expect(s.backgroundColor).toBe('#f0f0ff');
      expect(s.cornerRadius).toBe(4);
      expect(s.content).toBe(content);
    });
  });

  describe('measure', () => {
    it('returns padding + border when no content', () => {
      const s = new CShape({ padding: 10, borderWidth: 2 });
      const size = s.measure(ctx);
      expect(size.width).toBe(24); // 10+10 + 2+2
      expect(size.height).toBe(24);
    });

    it('includes content size', () => {
      const content = new CContainer({
        alignItems: 'start',
        children: [new CText({ text: 'Hello' })],
      });
      const s = new CShape({ padding: 5, content });
      const contentSize = content.measure(ctx);
      const size = s.measure(ctx);
      expect(size.width).toBe(contentSize.width + 10);
      expect(size.height).toBe(contentSize.height + 10);
    });

    it('propagates maxWidth to wrapped content', () => {
      const mockCtx = {
        ...ctx,
        font: '',
        measureText: vi.fn((text: string) => ({ width: text.length * 10 })),
      } as unknown as CanvasRenderingContext2D;

      const s = new CShape({
        padding: 5,
        borderWidth: 1,
        content: new CContainer({
          direction: 'column',
          children: [new CText({ text: 'one two three' })],
        }),
      });

      // Inner width = 100 - 10 (padding) - 2 (border) = 88 → 'one two' (70) / 'three' (50)
      const size = s.measure(mockCtx, 100);
      expect(size.width).toBe(70 + 10 + 2);
      expect(size.height).toBeCloseTo(2 * 14 * 1.2 + 10 + 2);
    });

    it('keeps longest word as floor when maxWidth is tiny', () => {
      const mockCtx = {
        ...ctx,
        font: '',
        measureText: vi.fn((text: string) => ({ width: text.length * 10 })),
      } as unknown as CanvasRenderingContext2D;

      const s = new CShape({
        padding: 5,
        borderWidth: 1,
        content: new CContainer({
          direction: 'column',
          children: [new CText({ text: 'one two three' })],
        }),
      });

      const size = s.measure(mockCtx, 0);
      expect(size.width).toBe(50 + 10 + 2);
      expect(size.height).toBeCloseTo(3 * 14 * 1.2 + 10 + 2);
    });
  });

  describe('render', () => {
    it('draws background rect', () => {
      const s = new CShape({ backgroundColor: '#eee' });
      s.render(ctx, { x: 10, y: 20, width: 100, height: 50 });
      expect(ctx.fillRect).toHaveBeenCalled();
      expect(ctx.fillStyle).toBe('#eee');
    });

    it('draws border rect', () => {
      const s = new CShape({ borderColor: '#333', borderWidth: 2 });
      s.render(ctx, { x: 10, y: 20, width: 100, height: 50 });
      expect(ctx.strokeRect).toHaveBeenCalled();
      expect(ctx.strokeStyle).toBe('#333');
      expect(ctx.lineWidth).toBe(2);
    });

    it('renders content inside padded area', () => {
      const t = new CText({ text: 'Hello' });
      const renderSpy = vi.spyOn(t, 'render');
      const content = new CContainer({ children: [t] });
      const s = new CShape({ padding: 10, content });

      s.render(ctx, { x: 0, y: 0, width: 200, height: 100 });

      expect(renderSpy).toHaveBeenCalled();
      const bounds = renderSpy.mock.calls[0]![1];
      expect(bounds.x).toBe(10);
      expect(bounds.y).toBe(10);
    });

    it('does not render when invisible', () => {
      const s = new CShape({
        backgroundColor: '#eee',
        style: { visible: false },
      });
      s.render(ctx, { x: 0, y: 0, width: 100, height: 50 });
      expect(ctx.fillRect).not.toHaveBeenCalled();
    });
  });

  describe('hitTest', () => {
    it('returns self when hit within bounds', () => {
      const s = new CShape({ backgroundColor: '#eee' });
      const hit = s.hitTest(
        { x: 50, y: 25 },
        { x: 0, y: 0, width: 100, height: 50 }
      );
      expect(hit).toBe(s);
    });

    it('returns null when outside bounds', () => {
      const s = new CShape();
      const hit = s.hitTest(
        { x: 150, y: 25 },
        { x: 0, y: 0, width: 100, height: 50 }
      );
      expect(hit).toBeNull();
    });

    it('hits content child instead of self', () => {
      const t = new CText({ text: 'Hello' });
      const content = new CContainer({ children: [t] });
      const s = new CShape({ content });

      // Need to render first to populate cached bounds
      s.render(ctx, { x: 0, y: 0, width: 200, height: 100 });

      const hit = s.hitTest(
        { x: 5, y: 5 },
        { x: 0, y: 0, width: 200, height: 100 }
      );
      expect(hit).toBe(t);
    });

    it('returns null when invisible', () => {
      const s = new CShape({ style: { visible: false } });
      const hit = s.hitTest(
        { x: 50, y: 25 },
        { x: 0, y: 0, width: 100, height: 50 }
      );
      expect(hit).toBeNull();
    });
  });

  describe('onChange', () => {
    it('fires when backgroundColor changes', () => {
      const s = new CShape();
      const cb = vi.fn();
      s.setOnChange(cb);
      s.backgroundColor = '#fff';
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('propagates from content child', () => {
      const t = new CText({ text: 'Hello' });
      const content = new CContainer({ children: [t] });
      const s = new CShape({ content });
      const cb = vi.fn();
      s.setOnChange(cb);

      t.text = 'Changed';
      expect(cb).toHaveBeenCalled();
    });
  });

  describe('serialize', () => {
    it('serializes minimal shape', () => {
      const s = new CShape();
      const data = s.serialize();
      expect(data.type).toBe('shape');
      expect(data.borderColor).toBeUndefined();
      expect(data.content).toBeUndefined();
    });

    it('serializes with content tree', () => {
      const s = new CShape({
        id: 'header',
        backgroundColor: '#f0f0ff',
        borderColor: '#333',
        borderWidth: 1,
        cornerRadius: 4,
        padding: 8,
        content: new CContainer({
          children: [new CText({ id: 'name', text: 'Title' })],
        }),
      });
      const data = s.serialize();
      expect(data.id).toBe('header');
      expect(data.backgroundColor).toBe('#f0f0ff');
      expect(data.borderColor).toBe('#333');
      expect(data.borderWidth).toBe(1);
      expect(data.cornerRadius).toBe(4);
      expect(data.padding).toBe(8);
      expect(data.content).toBeDefined();
      expect(data.content!.type).toBe('container');
      expect(data.content!.children![0]!.text).toBe('Title');
    });
  });

  describe('toSVG', () => {
    it('generates rect with fill and stroke', () => {
      const s = new CShape({
        backgroundColor: '#eee',
        borderColor: '#333',
        borderWidth: 1,
        cornerRadius: 4,
      });
      const svg = s.toSVG({ x: 10, y: 20, width: 100, height: 50 });
      expect(svg).toContain('<rect');
      expect(svg).toContain('fill="#eee"');
      expect(svg).toContain('stroke="#333"');
      expect(svg).toContain('rx="4"');
    });

    it('includes content SVG', () => {
      const s = new CShape({
        content: new CContainer({
          children: [new CText({ text: 'Inside' })],
        }),
      });
      const svg = s.toSVG({ x: 0, y: 0, width: 200, height: 100 });
      expect(svg).toContain('Inside');
    });

    it('returns empty when invisible', () => {
      const s = new CShape({ style: { visible: false } });
      expect(s.toSVG({ x: 0, y: 0, width: 100, height: 50 })).toBe('');
    });
  });
});
