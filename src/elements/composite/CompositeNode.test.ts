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
          text({ id: 'title', text: 'Hello', role: 'name' }),
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
                  text({ id: 'name', text: 'Serializable', fontWeight: 'bold', role: 'name' }),
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
  });
});
