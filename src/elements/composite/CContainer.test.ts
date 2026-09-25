import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CContainer } from './CContainer';
import { CText } from './CText';
import { CDivider } from './CDivider';
import { mockCanvasContext } from '@/test/testUtils';

describe('CContainer', () => {
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    ctx = mockCanvasContext() as unknown as CanvasRenderingContext2D;
  });

  describe('constructor', () => {
    it('uses defaults', () => {
      const c = new CContainer();
      expect(c.direction).toBe('column');
      expect(c.justifyContent).toBe('start');
      expect(c.alignItems).toBe('stretch');
      expect(c.gap).toBe(0);
      expect(c.children).toHaveLength(0);
    });

    it('accepts options with children', () => {
      const c = new CContainer({
        direction: 'row',
        gap: 8,
        children: [new CText({ text: 'A' }), new CText({ text: 'B' })],
      });
      expect(c.direction).toBe('row');
      expect(c.gap).toBe(8);
      expect(c.children).toHaveLength(2);
    });
  });

  describe('measure', () => {
    it('returns size based on children', () => {
      const c = new CContainer({
        direction: 'column',
        children: [new CText({ text: 'Hello' }), new CText({ text: 'World' })],
      });
      const size = c.measure(ctx);
      expect(size.width).toBeGreaterThan(0);
      expect(size.height).toBeGreaterThan(0);
    });

    it('includes padding in size', () => {
      const c1 = new CContainer({
        alignItems: 'start',
        children: [new CText({ text: 'Hi' })],
      });
      const c2 = new CContainer({
        alignItems: 'start',
        padding: 20,
        children: [new CText({ text: 'Hi' })],
      });
      const s1 = c1.measure(ctx);
      const s2 = c2.measure(ctx);
      expect(s2.width).toBe(s1.width + 40);
      expect(s2.height).toBe(s1.height + 40);
    });

    it('includes gap in size', () => {
      const c = new CContainer({
        direction: 'column',
        gap: 10,
        children: [new CText({ text: 'A' }), new CText({ text: 'B' })],
      });
      const size = c.measure(ctx);
      // Should include gap between 2 items
      const single = new CText({ text: 'A' }).measure(ctx);
      expect(size.height).toBeGreaterThan(single.height * 2);
    });

    describe('with availableWidth (word-wrap constraint)', () => {
      const widthByLength = (): CanvasRenderingContext2D =>
        ({
          ...ctx,
          font: '',
          measureText: vi.fn((text: string) => ({ width: text.length * 10 })),
        }) as unknown as CanvasRenderingContext2D;

      it('wraps column text children and grows height', () => {
        const c = new CContainer({
          direction: 'column',
          padding: 10,
          gap: 5,
          children: [new CText({ text: 'one two three' }), new CText({ text: 'short' })],
        });

        // Inner width = 100 - 20 = 80 → 'one two'(70)/'three'(50), 'short'(50)
        const size = c.measure(widthByLength(), 100);
        expect(size.width).toBe(10 + 70 + 10);
        expect(size.height).toBeCloseTo(10 + 2 * 14 * 1.2 + 5 + 14 * 1.2 + 10);
      });

      it('keeps unconstrained intrinsic size without availableWidth', () => {
        const c = new CContainer({
          direction: 'column',
          padding: 10,
          children: [new CText({ text: 'one two three' })],
        });

        const size = c.measure(widthByLength());
        expect(size.width).toBe(10 + 130 + 10);
        expect(size.height).toBeCloseTo(10 + 14 * 1.2 + 10);
      });

      it('propagates constraint into nested containers', () => {
        const inner = new CContainer({
          direction: 'column',
          children: [new CText({ text: 'one two three' })],
        });
        const outer = new CContainer({
          direction: 'column',
          children: [inner],
        });

        const size = outer.measure(widthByLength(), 80);
        expect(size.width).toBe(70);
        expect(size.height).toBeCloseTo(2 * 14 * 1.2);
      });
    });
  });

  describe('render', () => {
    it('renders all visible children', () => {
      const t1 = new CText({ text: 'A' });
      const t2 = new CText({ text: 'B' });
      const renderSpy1 = vi.spyOn(t1, 'render');
      const renderSpy2 = vi.spyOn(t2, 'render');

      const c = new CContainer({ children: [t1, t2] });
      c.render(ctx, { x: 0, y: 0, width: 200, height: 100 });

      expect(renderSpy1).toHaveBeenCalledTimes(1);
      expect(renderSpy2).toHaveBeenCalledTimes(1);
    });

    it('skips invisible children', () => {
      const t = new CText({ text: 'Hidden', style: { visible: false } });
      const spy = vi.spyOn(t, 'render');

      const c = new CContainer({ children: [t] });
      c.render(ctx, { x: 0, y: 0, width: 200, height: 100 });

      expect(spy).not.toHaveBeenCalled();
    });

    it('does not render when container itself is invisible', () => {
      const t = new CText({ text: 'A' });
      const spy = vi.spyOn(t, 'render');

      const c = new CContainer({ children: [t], style: { visible: false } });
      c.render(ctx, { x: 0, y: 0, width: 200, height: 100 });

      expect(spy).not.toHaveBeenCalled();
    });

    it('passes correct bounds to children in column layout', () => {
      const t1 = new CText({ text: 'A', fontSize: 14 });
      const t2 = new CText({ text: 'B', fontSize: 14 });
      const spy1 = vi.spyOn(t1, 'render');
      const spy2 = vi.spyOn(t2, 'render');

      const c = new CContainer({ direction: 'column', children: [t1, t2] });
      c.render(ctx, { x: 10, y: 20, width: 200, height: 100 });

      // First child should start at container origin
      const bounds1 = spy1.mock.calls[0]![1];
      const bounds2 = spy2.mock.calls[0]![1];
      expect(bounds1.x).toBe(10);
      expect(bounds1.y).toBe(20);
      // Second child should be below first
      expect(bounds2.y).toBeGreaterThan(bounds1.y);
    });
  });

  describe('hitTest', () => {
    it('returns the child component that was hit', () => {
      const t1 = new CText({ text: 'A' });
      const t2 = new CText({ text: 'B' });
      const c = new CContainer({
        direction: 'column',
        children: [t1, t2],
      });

      // Render first to populate cached bounds
      c.render(ctx, { x: 0, y: 0, width: 200, height: 100 });

      // Hit first child area
      const hit = c.hitTest({ x: 5, y: 5 }, { x: 0, y: 0, width: 200, height: 100 });
      expect(hit).toBe(t1);
    });

    it('returns null when clicking outside children', () => {
      const t = new CText({ text: 'A' });
      const c = new CContainer({ children: [t], padding: 50 });

      c.render(ctx, { x: 0, y: 0, width: 200, height: 200 });

      // Click in padding area far from content — should miss children
      const result = c.hitTest({ x: 199, y: 199 }, { x: 0, y: 0, width: 200, height: 200 });
      expect(result).toBeNull();
    });

    it('returns null when not rendered yet (no cached bounds)', () => {
      const c = new CContainer({
        children: [new CText({ text: 'A' })],
      });
      const hit = c.hitTest({ x: 50, y: 50 }, { x: 0, y: 0, width: 200, height: 100 });
      expect(hit).toBeNull();
    });

    it('returns null when invisible', () => {
      const c = new CContainer({
        children: [new CText({ text: 'A' })],
        style: { visible: false },
      });
      c.render(ctx, { x: 0, y: 0, width: 200, height: 100 });
      const hit = c.hitTest({ x: 50, y: 50 }, { x: 0, y: 0, width: 200, height: 100 });
      expect(hit).toBeNull();
    });
  });

  describe('addChild / removeChild / insertChild', () => {
    it('addChild appends and wires onChange', () => {
      const c = new CContainer();
      const cb = vi.fn();
      c.setOnChange(cb);

      const t = new CText({ text: 'New' });
      c.addChild(t);

      expect(c.children).toHaveLength(1);
      expect(cb).toHaveBeenCalled();

      // Child change should propagate
      cb.mockClear();
      t.text = 'Changed';
      expect(cb).toHaveBeenCalled();
    });

    it('removeChild removes and unwires onChange', () => {
      const t = new CText({ text: 'Hello' });
      const c = new CContainer({ children: [t] });
      const cb = vi.fn();
      c.setOnChange(cb);

      const removed = c.removeChild(0);
      expect(removed).toBe(t);
      expect(c.children).toHaveLength(0);
      expect(cb).toHaveBeenCalled();

      // Removed child should not trigger container change
      cb.mockClear();
      t.text = 'Changed';
      expect(cb).not.toHaveBeenCalled();
    });

    it('insertChild inserts at index', () => {
      const t1 = new CText({ text: 'A' });
      const t2 = new CText({ text: 'C' });
      const c = new CContainer({ children: [t1, t2] });

      const t3 = new CText({ text: 'B' });
      c.insertChild(1, t3);

      expect(c.children).toHaveLength(3);
      expect(c.children[1]).toBe(t3);
    });
  });

  describe('findBoundNameText', () => {
    it('finds a direct __name__ text even when suppressed', () => {
      const name = new CText({ text: 'Start', bindToProperty: '__name__', color: '#cc0000' });
      const c = new CContainer({ children: [name, new CText({ text: '+' })] });
      c.setSuppressBoundName(true);
      expect(c.findBoundNameText()).toBe(name);
    });

    it('finds a nested __name__ text', () => {
      const name = new CText({ text: 'Start', bindToProperty: '__name__' });
      const outer = new CContainer({
        children: [new CContainer({ children: [name] })],
      });
      expect(outer.findBoundNameText()).toBe(name);
    });

    it('returns undefined when there is no bound name', () => {
      const c = new CContainer({ children: [new CText({ text: '+' })] });
      expect(c.findBoundNameText()).toBeUndefined();
    });
  });

  describe('findById', () => {
    it('finds direct child by id', () => {
      const t = new CText({ id: 'title', text: 'Hello' });
      const c = new CContainer({ children: [t] });
      expect(c.findById('title')).toBe(t);
    });

    it('finds nested child by id', () => {
      const t = new CText({ id: 'deep', text: 'Hello' });
      const inner = new CContainer({ children: [t] });
      const outer = new CContainer({ children: [inner] });
      expect(outer.findById('deep')).toBe(t);
    });

    it('returns undefined for non-existent id', () => {
      const c = new CContainer({ children: [new CText({ text: 'A' })] });
      expect(c.findById('nope')).toBeUndefined();
    });
  });

  describe('onChange propagation', () => {
    it('propagates from nested child', () => {
      const t = new CText({ text: 'Hello' });
      const inner = new CContainer({ children: [t] });
      const outer = new CContainer({ children: [inner] });
      const cb = vi.fn();
      outer.setOnChange(cb);

      t.text = 'Changed';
      expect(cb).toHaveBeenCalled();
    });
  });

  describe('serialize', () => {
    it('serializes container with children', () => {
      const c = new CContainer({
        direction: 'row',
        gap: 8,
        padding: 10,
        justifyContent: 'center',
        alignItems: 'center',
        children: [
          new CText({ text: 'A' }),
          new CDivider(),
          new CText({ text: 'B' }),
        ],
      });
      const data = c.serialize();
      expect(data.type).toBe('container');
      expect(data.direction).toBe('row');
      expect(data.gap).toBe(8);
      expect(data.padding).toBe(10);
      expect(data.justifyContent).toBe('center');
      expect(data.alignItems).toBe('center');
      expect(data.children).toHaveLength(3);
      expect(data.children![0]!.type).toBe('text');
      expect(data.children![1]!.type).toBe('divider');
    });

    it('omits default values', () => {
      const c = new CContainer({ children: [new CText({ text: 'A' })] });
      const data = c.serialize();
      expect(data.justifyContent).toBeUndefined();
      expect(data.alignItems).toBeUndefined();
      expect(data.gap).toBeUndefined();
      expect(data.padding).toBeUndefined();
    });
  });

  describe('toSVG', () => {
    it('generates g element with child SVGs', () => {
      const c = new CContainer({
        children: [new CText({ text: 'Hello' })],
      });
      const svg = c.toSVG({ x: 0, y: 0, width: 200, height: 100 });
      expect(svg).toContain('<g>');
      expect(svg).toContain('<text');
      expect(svg).toContain('</g>');
    });

    it('returns empty when invisible', () => {
      const c = new CContainer({ style: { visible: false } });
      expect(c.toSVG({ x: 0, y: 0, width: 200, height: 100 })).toBe('');
    });
  });
});
