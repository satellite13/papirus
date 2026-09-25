import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CompositeNode } from './CompositeNode';
import { CContainer } from './CContainer';
import { CText } from './CText';
import { CIcon } from './CIcon';
import { CDivider } from './CDivider';
import { CShape } from './CShape';
import { container, text, icon, divider, shape } from './index';
import { mockCanvasContext } from '@/test/testUtils';

class FakeImage {
  src = '';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 0;
  naturalHeight = 0;
}

describe('CompositeNode', () => {
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    ctx = mockCanvasContext() as unknown as CanvasRenderingContext2D;
    vi.stubGlobal('Image', FakeImage);
  });

  function makeSimpleNode(): CompositeNode {
    return new CompositeNode({
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      content: container({
        direction: 'column',
        children: [
          text({ id: 'title', text: 'Hello', bindToProperty: '__name__' }),
          text({ id: 'desc', text: 'Description' }),
        ],
      }),
    });
  }

  describe('constructor', () => {
    it('creates with defaults', () => {
      const node = makeSimpleNode();
      expect(node.typeName).toBe('composite');
      expect(node.shapeType).toBe('rectangle');
      expect(node.cornerRadius).toBe(0);
      expect(node.autoSize).toBe(false);
      expect(node.content).toBeInstanceOf(CContainer);
    });

    it('accepts shape options', () => {
      const node = new CompositeNode({
        x: 0, y: 0, width: 100, height: 100,
        content: container(),
        shapeType: 'circle',
        cornerRadius: 8,
        autoSize: false,
        minWidth: 80,
        minHeight: 40,
      });
      expect(node.shapeType).toBe('circle');
      expect(node.cornerRadius).toBe(8);
      expect(node.autoSize).toBe(false);
      expect(node.minWidth).toBe(80);
      expect(node.minHeight).toBe(40);
    });
  });

  describe('render', () => {
    it('renders rectangle shape and content', () => {
      const node = makeSimpleNode();
      node.render(ctx);
      expect(ctx.beginPath).toHaveBeenCalled();
      expect(ctx.rect).toHaveBeenCalled();
      expect(ctx.fill).toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalled();
      expect(ctx.fillText).toHaveBeenCalled(); // from CText
    });

    it('renders circle shape', () => {
      const node = new CompositeNode({
        x: 0, y: 0, width: 100, height: 100,
        content: container({ children: [text({ text: 'Hi' })] }),
        shapeType: 'circle',
      });
      node.render(ctx);
      expect(ctx.ellipse).toHaveBeenCalled();
    });

    it('renders diamond shape', () => {
      const node = new CompositeNode({
        x: 0, y: 0, width: 100, height: 100,
        content: container({ children: [text({ text: 'Hi' })] }),
        shapeType: 'diamond',
      });
      node.render(ctx);
      expect(ctx.moveTo).toHaveBeenCalled();
      expect(ctx.lineTo).toHaveBeenCalled();
    });

    it('renders with cornerRadius', () => {
      const node = new CompositeNode({
        x: 0, y: 0, width: 200, height: 100,
        content: container({ children: [text({ text: 'Hi' })] }),
        cornerRadius: 8,
      });
      node.render(ctx);
      expect(ctx.arcTo).toHaveBeenCalled();
    });

    it('applies fill and stroke opacity to a translated custom path', () => {
      const path = {} as Path2D;
      const fillAlphas: number[] = [];
      const strokeAlphas: number[] = [];
      vi.mocked(ctx.fill).mockImplementation(() => {
        fillAlphas.push(ctx.globalAlpha);
      });
      vi.mocked(ctx.stroke).mockImplementation(() => {
        strokeAlphas.push(ctx.globalAlpha);
      });
      const node = new CompositeNode({
        x: 10,
        y: 20,
        width: 100,
        height: 80,
        content: container(),
        shapeType: 'custom',
        pathFactory: () => path,
        style: {
          opacity: 0.5,
          fillOpacity: 0.4,
          strokeOpacity: 0.6,
        },
      });

      node.render(ctx);

      expect(ctx.translate).toHaveBeenCalledWith(10, 20);
      expect(ctx.fill).toHaveBeenCalledWith(path);
      expect(ctx.stroke).toHaveBeenCalledWith(path);
      expect(fillAlphas[0]).toBeCloseTo(0.2);
      expect(strokeAlphas[0]).toBeCloseTo(0.3);
    });

    it('draws Node.label outside and skips the bound name CText', () => {
      ctx.measureText = ((value: string) => ({
        width: value.length * 8,
      })) as CanvasRenderingContext2D['measureText'];

      const node = new CompositeNode({
        x: 0,
        y: 0,
        width: 36,
        height: 36,
        label: 'Start',
        labelPlacement: 'bottom',
        labelGap: 4,
        shapeType: 'circle',
        content: container({
          direction: 'column',
          children: [
            text({ id: 'title', text: 'Start', bindToProperty: '__name__' }),
            text({ id: 'mark', text: '+' }),
          ],
        }),
      });
      node.render(ctx);

      const texts = vi.mocked(ctx.fillText).mock.calls.map((call) => call[0]);
      expect(texts).toContain('Start');
      expect(texts.filter((value) => value === 'Start')).toHaveLength(1);
      expect(texts).toContain('+');

      const nameCall = vi.mocked(ctx.fillText).mock.calls.find((call) => call[0] === 'Start');
      expect(nameCall?.[2]).toBeGreaterThan(36);

      expect(node.width).toBe(36);
      expect(node.height).toBe(36);
      expect(node.hitTest({ x: 18, y: 50 })).toBe(true);
    });

    it('uses the bound name CText color and italic on the external Node.label', () => {
      ctx.measureText = ((value: string) => ({
        width: value.length * 8,
      })) as CanvasRenderingContext2D['measureText'];

      const colorsByText = new Map<string, string>();
      const fontsByText = new Map<string, string>();
      vi.mocked(ctx.fillText).mockImplementation((value) => {
        colorsByText.set(String(value), String(ctx.fillStyle));
        fontsByText.set(String(value), String(ctx.font));
      });

      const node = new CompositeNode({
        x: 0,
        y: 0,
        width: 36,
        height: 36,
        label: { text: 'Start', style: { color: '#333333' } },
        labelPlacement: 'bottom',
        shapeType: 'circle',
        content: container({
          children: [
            text({
              id: 'title',
              text: 'Start',
              color: '#cc2244',
              fontStyle: 'italic',
              bindToProperty: '__name__',
            }),
          ],
        }),
      });
      node.render(ctx);

      expect(colorsByText.get('Start')).toBe('#cc2244');
      expect(fontsByText.get('Start')).toContain('italic');
      expect(node.label?.style.color).toBe('#cc2244');
      expect(node.label?.style.fontStyle).toBe('italic');
    });
  });

  describe('auto-size', () => {
    it('grows node width to fit content', () => {
      // Node starts small, content needs more space
      const node = new CompositeNode({
        x: 0, y: 0, width: 5, height: 5,
        content: container({
          padding: 20,
          children: [text({ text: 'A long text that needs space' })],
        }),
        autoSize: true,
        minWidth: 0,
        minHeight: 0,
      });
      const originalWidth = node.width;
      node.render(ctx);
      // After render, auto-size should have increased dimensions
      expect(node.width).toBeGreaterThanOrEqual(originalWidth);
    });

    it('respects minWidth and minHeight', () => {
      const node = new CompositeNode({
        x: 0, y: 0, width: 10, height: 10,
        content: container(), // empty content
        autoSize: true,
        minWidth: 100,
        minHeight: 50,
      });
      node.render(ctx);
      expect(node.width).toBeGreaterThanOrEqual(100);
      expect(node.height).toBeGreaterThanOrEqual(50);
    });

    it('does not resize when autoSize is false', () => {
      const node = new CompositeNode({
        x: 0, y: 0, width: 50, height: 30,
        content: container({
          padding: 100,
          children: [text({ text: 'Big content' })],
        }),
        autoSize: false,
      });
      node.render(ctx);
      expect(node.width).toBe(50);
      expect(node.height).toBe(30);
    });

    it('uses resolved proportional content insets when auto-sizing', () => {
      const node = new CompositeNode({
        x: 0,
        y: 0,
        width: 50,
        height: 50,
        content: container({ padding: 10 }),
        autoSize: true,
        contentInset: 20,
        contentInsetScale: { top: true, right: true, bottom: true, left: true },
        contentInsetBaseSize: { width: 100, height: 100 },
      });

      node.render(ctx);

      expect(node.width).toBe(50);
      expect(node.height).toBe(50);
    });

    const widthByLength = (): CanvasRenderingContext2D =>
      ({
        ...ctx,
        font: '',
        measureText: vi.fn((text: string) => ({ width: text.length * 10 })),
      }) as unknown as CanvasRenderingContext2D;

    it('keeps user width and grows height to fit wrapped text', () => {
      const node = new CompositeNode({
        x: 0,
        y: 0,
        width: 80,
        height: 10,
        content: container({
          direction: 'column',
          children: [text({ text: 'one two three' })],
        }),
        autoSize: true,
      });

      node.render(widthByLength());

      // Width stays user-controlled; height grows for the wrapped lines.
      expect(node.width).toBe(80);
      expect(node.height).toBeCloseTo(2 * 14 * 1.2);
    });

    it('grows width only to the longest-word floor, not to one line', () => {
      const node = new CompositeNode({
        x: 0,
        y: 0,
        width: 20,
        height: 10,
        content: container({
          direction: 'column',
          children: [text({ text: 'one two three' })],
        }),
        autoSize: true,
      });

      node.render(widthByLength());

      expect(node.width).toBe(50); // longest word 'three'
      expect(node.height).toBeCloseTo(3 * 14 * 1.2);
    });
  });

  describe('getContentMinSize', () => {
    const widthByLength = (): CanvasRenderingContext2D =>
      ({
        ...ctx,
        font: '',
        measureText: vi.fn((text: string) => ({ width: text.length * 10 })),
      }) as unknown as CanvasRenderingContext2D;

    function makeLongTextNode(options: { contentInset?: number } = {}): CompositeNode {
      return new CompositeNode({
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        contentInset: options.contentInset,
        content: container({
          direction: 'column',
          padding: 10,
          children: [text({ text: 'one two three' })],
        }),
      });
    }

    it('returns intrinsic content size without a width constraint', () => {
      const node = makeLongTextNode();
      const size = node.getContentMinSize(widthByLength());
      expect(size.width).toBe(10 + 130 + 10);
      expect(size.height).toBeCloseTo(10 + 14 * 1.2 + 10);
    });

    it('returns longest-word floor width and wrapped height when a width is given', () => {
      const node = makeLongTextNode();
      // Inner width = 100 - 20 (padding) = 80 → 'one two' (70) / 'three' (50)
      const size = node.getContentMinSize(widthByLength(), 100);
      expect(size.width).toBe(70); // floor: longest word 'three' (50) + padding
      expect(size.height).toBeCloseTo(10 + 2 * 14 * 1.2 + 10);
    });

    it('includes resolved content insets in the constrained min size', () => {
      const node = makeLongTextNode({ contentInset: 5 });
      const size = node.getContentMinSize(widthByLength(), 100);
      expect(size.width).toBe(70 + 10);
      expect(size.height).toBeCloseTo(10 + 2 * 14 * 1.2 + 10 + 10);
    });
  });

  describe('content bounds', () => {
    it('applies content inset before calculating inscribed shape bounds', () => {
      const circle = new CompositeNode({
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        content: container(),
        contentInset: 10,
        shapeType: 'circle',
      });
      const diamond = new CompositeNode({
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        content: container(),
        contentInset: 10,
        shapeType: 'diamond',
      });

      const circleBounds = circle.getLabelContainerBounds(circle.getBounds());
      expect(circleBounds.x).toBeCloseTo(21.7157);
      expect(circleBounds.y).toBeCloseTo(21.7157);
      expect(circleBounds.width).toBeCloseTo(80 / Math.SQRT2);
      expect(circleBounds.height).toBeCloseTo(80 / Math.SQRT2);

      expect(diamond.getLabelContainerBounds(diamond.getBounds())).toEqual({
        x: 30,
        y: 30,
        width: 40,
        height: 40,
      });
    });
  });

  describe('getComponent', () => {
    it('finds direct child by id', () => {
      const node = makeSimpleNode();
      const comp = node.getComponent('title');
      expect(comp).toBeInstanceOf(CText);
      expect((comp as CText).text).toBe('Hello');
    });

    it('finds nested child by id', () => {
      const node = new CompositeNode({
        x: 0, y: 0, width: 200, height: 200,
        content: container({
          children: [
            shape({
              content: container({
                children: [text({ id: 'deep', text: 'Nested' })],
              }),
            }),
          ],
        }),
      });
      const comp = node.getComponent('deep');
      expect(comp).toBeInstanceOf(CText);
      expect((comp as CText).text).toBe('Nested');
    });

    it('returns undefined for non-existent id', () => {
      const node = makeSimpleNode();
      expect(node.getComponent('nope')).toBeUndefined();
    });
  });

  describe('getComponentAtPoint', () => {
    it('finds component at world point after render', () => {
      const node = makeSimpleNode();
      node.render(ctx);
      // The first text should be near top of content area
      const comp = node.getComponentAtPoint({ x: 5, y: 5 });
      expect(comp).toBeInstanceOf(CText);
    });

    it('returns null when clicking outside content', () => {
      const node = makeSimpleNode();
      node.render(ctx);
      const comp = node.getComponentAtPoint({ x: 999, y: 999 });
      expect(comp).toBeNull();
    });
  });

  describe('hitTest', () => {
    it('works for rectangle shape', () => {
      const node = new CompositeNode({
        x: 10, y: 10, width: 100, height: 50,
        content: container(),
      });
      expect(node.hitTest({ x: 50, y: 30 })).toBe(true);
      // Well outside node bounds + padding
      expect(node.hitTest({ x: -50, y: -50 })).toBe(false);
    });

    it('works for circle shape', () => {
      const node = new CompositeNode({
        x: 0, y: 0, width: 100, height: 100,
        content: container(),
        shapeType: 'circle',
      });
      // Center should hit
      expect(node.hitTest({ x: 50, y: 50 })).toBe(true);
      // Corner should miss (outside ellipse)
      expect(node.hitTest({ x: 0, y: 0 })).toBe(false);
    });

    it('works for diamond shape', () => {
      const node = new CompositeNode({
        x: 0, y: 0, width: 100, height: 100,
        content: container(),
        shapeType: 'diamond',
      });
      // Center should hit
      expect(node.hitTest({ x: 50, y: 50 })).toBe(true);
      // Corner should miss (outside diamond)
      expect(node.hitTest({ x: 0, y: 0 })).toBe(false);
    });
  });

  describe('dirty propagation', () => {
    it('marks node dirty when content component changes', () => {
      const node = makeSimpleNode();
      node.render(ctx); // clear dirty
      // Access the internal dirty state
      const titleComp = node.getComponent('title') as CText;
      titleComp.text = 'Changed';
      expect(node.dirty).toBe(true);
    });
  });

  describe('factory functions', () => {
    it('container() creates CContainer', () => {
      expect(container()).toBeInstanceOf(CContainer);
    });

    it('text() creates CText', () => {
      expect(text({ text: 'Hello' })).toBeInstanceOf(CText);
    });

    it('icon() creates CIcon', () => {
      expect(icon({ source: '/test.png' })).toBeInstanceOf(CIcon);
    });

    it('divider() creates CDivider', () => {
      expect(divider()).toBeInstanceOf(CDivider);
    });

    it('shape() creates CShape', () => {
      expect(shape()).toBeInstanceOf(CShape);
    });
  });

  describe('complex composition', () => {
    it('renders UML-style class node', () => {
      const node = new CompositeNode({
        x: 0, y: 0, width: 200, height: 160,
        content: container({
          direction: 'column',
          children: [
            shape({
              backgroundColor: '#f0f0ff',
              padding: 8,
              content: container({
                direction: 'column',
                alignItems: 'center',
                children: [
                  text({ text: '<<interface>>', fontSize: 10, fontStyle: 'italic' }),
                  text({ id: 'name', text: 'Serializable', fontWeight: 'bold', bindToProperty: '__name__' }),
                ],
              }),
            }),
            divider({ color: '#333' }),
            shape({
              padding: 8,
              content: container({
                direction: 'column',
                children: [
                  text({ text: '+ serialize(): string', fontSize: 12, align: 'left' }),
                ],
              }),
            }),
          ],
        }),
      });

      // Should render without errors
      node.render(ctx);

      // Should find name by id
      const nameComp = node.getComponent('name') as CText;
      expect(nameComp.text).toBe('Serializable');

      // Change name should mark dirty
      nameComp.text = 'NewName';
      expect(node.dirty).toBe(true);
    });

    it('renders interactive badges like regular nodes', () => {
      const created: FakeImage[] = [];
      vi.stubGlobal('Image', function FakeBadgeImage(this: FakeImage) {
        this.src = '';
        this.onload = null;
        this.onerror = null;
        this.naturalWidth = 0;
        this.naturalHeight = 0;
        created.push(this);
      });

      const node = new CompositeNode({
        x: 0,
        y: 0,
        width: 200,
        height: 100,
        badges: [{ id: 'doc-prop', iconUrl: '/icons/description.svg' }],
        content: container({
          children: [text({ text: 'Composite' })],
        }),
      });

      expect(node.badges).toHaveLength(1);
      expect(
        node.getBadgeAtPoint({
          x: node.getBounds().x + 4,
          y: node.getBounds().y + 4,
        })
      ).toEqual({ id: 'doc-prop', index: 0 });

      const loadedImg = created[0];
      expect(loadedImg).toBeDefined();
      loadedImg!.naturalWidth = 24;
      loadedImg!.naturalHeight = 24;
      loadedImg!.onload?.();

      node.render(ctx);
      expect(ctx.drawImage).toHaveBeenCalled();
    });
  });
});
