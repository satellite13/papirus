import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CText } from './CText';
import { deserializeCComponent } from './deserialize';
import { mockCanvasContext } from '@/test/testUtils';

describe('CText', () => {
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    ctx = mockCanvasContext() as unknown as CanvasRenderingContext2D;
  });

  describe('constructor', () => {
    it('uses defaults for omitted options', () => {
      const t = new CText({ text: 'Hello' });
      expect(t.text).toBe('Hello');
      expect(t.fontFamily).toBe('sans-serif');
      expect(t.fontWeight).toBe('normal');
      expect(t.fontStyle).toBe('normal');
      expect(t.fontSize).toBe(14);
      expect(t.color).toBe('#000000');
      expect(t.align).toBe('center');
      expect(t.verticalAlign).toBe('middle');
      expect(t.rotation).toBe(0);
      expect(t.role).toBeUndefined();
      expect(t.id).toBeUndefined();
    });

    it('accepts all options', () => {
      const t = new CText({
        id: 'title',
        text: 'Test',
        fontFamily: 'Arial',
        fontWeight: 'bold',
        fontStyle: 'italic',
        fontSize: 20,
        color: '#ff0000',
        align: 'left',
        verticalAlign: 'top',
        maxLines: 2,
        lineHeight: 1.5,
        role: 'caption',
        rotation: -90,
        style: { flexGrow: 1 },
      });
      expect(t.id).toBe('title');
      expect(t.fontFamily).toBe('Arial');
      expect(t.fontWeight).toBe('bold');
      expect(t.fontStyle).toBe('italic');
      expect(t.fontSize).toBe(20);
      expect(t.color).toBe('#ff0000');
      expect(t.align).toBe('left');
      expect(t.verticalAlign).toBe('top');
      expect(t.maxLines).toBe(2);
      expect(t.lineHeight).toBe(1.5);
      expect(t.role).toBe('caption');
      expect(t.rotation).toBe(-90);
      expect(t.style.flexGrow).toBe(1);
    });
  });

  describe('measure', () => {
    it('returns size based on text measurement', () => {
      const t = new CText({ text: 'Hello', fontSize: 14 });
      const size = t.measure(ctx);
      // mockCanvasContext measureText returns { width: 10 }
      expect(size.width).toBe(10);
      expect(size.height).toBe(14 * 1.2); // fontSize * lineHeight
    });

    it('measures multiline text (newlines)', () => {
      const t = new CText({ text: 'Line1\nLine2\nLine3', fontSize: 10 });
      const size = t.measure(ctx);
      expect(size.height).toBe(3 * 10 * 1.2);
    });

    it('respects maxLines', () => {
      const t = new CText({ text: 'A\nB\nC\nD', fontSize: 10, maxLines: 2 });
      const size = t.measure(ctx);
      expect(size.height).toBe(2 * 10 * 1.2);
    });

    it('transposes dimensions for 90-degree rotation', () => {
      const t = new CText({ text: 'Hello', fontSize: 14, rotation: -90 });
      const size = t.measure(ctx);
      // Normal would be width=10, height=16.8
      // Rotated: width=16.8, height=10
      expect(size.width).toBe(14 * 1.2);
      expect(size.height).toBe(10);
    });

    it('transposes dimensions for +90 rotation', () => {
      const t = new CText({ text: 'Hello', fontSize: 14, rotation: 90 });
      const size = t.measure(ctx);
      expect(size.width).toBe(14 * 1.2);
      expect(size.height).toBe(10);
    });
  });

  describe('render', () => {
    it('calls fillText with correct parameters', () => {
      const t = new CText({ text: 'Hello', fontSize: 14 });
      t.render(ctx, { x: 10, y: 20, width: 100, height: 50 });
      expect(ctx.fillText).toHaveBeenCalled();
    });

    it('keeps text while the element still overlaps the canvas', () => {
      Object.assign(ctx, {
        canvas: { width: 200, height: 100 },
        getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
      });
      const t = new CText({ text: 'Hello', fontSize: 14, align: 'center' });
      t.render(ctx, { x: -80, y: 20, width: 120, height: 40 });
      expect(ctx.fillText).toHaveBeenCalled();
    });

    it('sets font, fillStyle, textAlign', () => {
      const t = new CText({
        text: 'Test',
        fontFamily: 'Arial',
        fontWeight: 'bold',
        fontStyle: 'italic',
        fontSize: 20,
        color: '#ff0000',
        align: 'left',
      });
      t.render(ctx, { x: 0, y: 0, width: 200, height: 50 });
      expect(ctx.font).toBe('italic bold 20px Arial');
      expect(ctx.fillStyle).toBe('#ff0000');
      expect(ctx.textAlign).toBe('left');
    });

    it('does not render when visible is false', () => {
      const t = new CText({ text: 'Hello', style: { visible: false } });
      t.render(ctx, { x: 0, y: 0, width: 100, height: 50 });
      expect(ctx.fillText).not.toHaveBeenCalled();
    });

    it('applies opacity', () => {
      const t = new CText({ text: 'Hello', style: { opacity: 0.5 } });
      t.render(ctx, { x: 0, y: 0, width: 100, height: 50 });
      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.restore).toHaveBeenCalled();
    });

    it('calls rotate for rotated text', () => {
      const t = new CText({ text: 'Hello', rotation: -90 });
      t.render(ctx, { x: 0, y: 0, width: 20, height: 100 });
      expect(ctx.rotate).toHaveBeenCalled();
      expect(ctx.translate).toHaveBeenCalled();
    });

    it('does not call rotate for non-rotated text', () => {
      const t = new CText({ text: 'Hello' });
      t.render(ctx, { x: 0, y: 0, width: 100, height: 50 });
      expect(ctx.rotate).not.toHaveBeenCalled();
    });
  });

  describe('wrapText', () => {
    it('returns single line for short text', () => {
      const t = new CText({ text: 'Hi' });
      const lines = t.wrapText(ctx, 100);
      expect(lines).toEqual(['Hi']);
    });

    it('truncates with ellipsis at maxLines', () => {
      // Mock measureText to return large widths to force wrapping
      const mockCtx = {
        ...ctx,
        font: '',
        measureText: vi.fn((text: string) => ({ width: text.length * 10 })),
      } as unknown as CanvasRenderingContext2D;

      const t = new CText({
        text: 'one two three four five six',
        maxLines: 2,
      });
      const lines = t.wrapText(mockCtx, 50);
      expect(lines.length).toBe(2);
      expect(lines[1]).toContain('…');
    });
  });

  describe('hitTest', () => {
    it('returns this when point is inside bounds', () => {
      const t = new CText({ text: 'Hello' });
      const result = t.hitTest({ x: 50, y: 25 }, { x: 0, y: 0, width: 100, height: 50 });
      expect(result).toBe(t);
    });

    it('returns null when point is outside bounds', () => {
      const t = new CText({ text: 'Hello' });
      const result = t.hitTest({ x: 150, y: 25 }, { x: 0, y: 0, width: 100, height: 50 });
      expect(result).toBeNull();
    });

    it('returns null when visible is false', () => {
      const t = new CText({ text: 'Hello', style: { visible: false } });
      const result = t.hitTest({ x: 50, y: 25 }, { x: 0, y: 0, width: 100, height: 50 });
      expect(result).toBeNull();
    });
  });

  describe('serialize', () => {
    it('serializes minimal text', () => {
      const t = new CText({ text: 'Hello' });
      const data = t.serialize();
      expect(data.type).toBe('text');
      expect(data.text).toBe('Hello');
      // Defaults should not be serialized
      expect(data.fontFamily).toBeUndefined();
      expect(data.fontSize).toBeUndefined();
      expect(data.color).toBeUndefined();
    });

    it('serializes all non-default properties', () => {
      const t = new CText({
        id: 'title',
        text: 'Test',
        fontFamily: 'Arial',
        fontWeight: 'bold',
        fontStyle: 'italic',
        fontSize: 20,
        color: '#ff0000',
        align: 'left',
        verticalAlign: 'top',
        maxLines: 3,
        lineHeight: 1.5,
        bindToProperty: '__name__',
        rotation: -90,
        style: { flexGrow: 1 },
      });
      const data = t.serialize();
      expect(data.id).toBe('title');
      expect(data.fontFamily).toBe('Arial');
      expect(data.fontWeight).toBe('bold');
      expect(data.fontStyle).toBe('italic');
      expect(data.fontSize).toBe(20);
      expect(data.color).toBe('#ff0000');
      expect(data.align).toBe('left');
      expect(data.verticalAlign).toBe('top');
      expect(data.maxLines).toBe(3);
      expect(data.lineHeight).toBe(1.5);
      expect(data.bindToProperty).toBe('__name__');
      expect(data.rotation).toBe(-90);
      expect(data.style?.flexGrow).toBe(1);
    });

    it('serializes bindToProperty for name binding without role', () => {
      const t = new CText({ text: 'Node', bindToProperty: '__name__' });
      const data = t.serialize();
      expect(data.bindToProperty).toBe('__name__');
      expect(t.bindToProperty).toBe('__name__');
    });

    it('deserializes bindToProperty', () => {
      const c = deserializeCComponent({
        type: 'text',
        text: 'X',
        bindToProperty: '__name__',
      });
      expect(c.type).toBe('text');
      expect(c).toBeInstanceOf(CText);
      expect((c as CText).bindToProperty).toBe('__name__');
    });

  });

  describe('toSVG', () => {
    it('generates text element', () => {
      const t = new CText({ text: 'Hello' });
      const svg = t.toSVG({ x: 10, y: 20, width: 100, height: 50 });
      expect(svg).toContain('<text');
      expect(svg).toContain('Hello');
      expect(svg).toContain('text-anchor="middle"');
    });

    it('applies rotation transform', () => {
      const t = new CText({ text: 'Vertical', rotation: -90 });
      const svg = t.toSVG({ x: 0, y: 0, width: 20, height: 100 });
      expect(svg).toContain('transform="rotate(-90');
    });

    it('returns empty string when not visible', () => {
      const t = new CText({ text: 'Hidden', style: { visible: false } });
      const svg = t.toSVG({ x: 0, y: 0, width: 100, height: 50 });
      expect(svg).toBe('');
    });

    it('escapes XML characters', () => {
      const t = new CText({ text: '<script>&"test"</script>' });
      const svg = t.toSVG({ x: 0, y: 0, width: 200, height: 50 });
      expect(svg).toContain('&lt;script&gt;');
      expect(svg).toContain('&amp;');
      expect(svg).toContain('&quot;');
    });
  });

  describe('onChange', () => {
    it('fires onChange when text changes', () => {
      const t = new CText({ text: 'Hello' });
      const cb = vi.fn();
      t.setOnChange(cb);
      t.text = 'World';
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('fires onChange when fontSize changes', () => {
      const t = new CText({ text: 'Hello' });
      const cb = vi.fn();
      t.setOnChange(cb);
      t.fontSize = 20;
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('fires onChange when color changes', () => {
      const t = new CText({ text: 'Hello' });
      const cb = vi.fn();
      t.setOnChange(cb);
      t.color = '#ff0000';
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('fires onChange when rotation changes', () => {
      const t = new CText({ text: 'Hello' });
      const cb = vi.fn();
      t.setOnChange(cb);
      t.rotation = -90;
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('does not fire when value is the same', () => {
      const t = new CText({ text: 'Hello' });
      const cb = vi.fn();
      t.setOnChange(cb);
      t.text = 'Hello';
      expect(cb).not.toHaveBeenCalled();
    });

    it('does not fire after setOnChange(undefined)', () => {
      const t = new CText({ text: 'Hello' });
      const cb = vi.fn();
      t.setOnChange(cb);
      t.setOnChange(undefined);
      t.text = 'World';
      expect(cb).not.toHaveBeenCalled();
    });
  });
});
