import { describe, it, expect, vi } from 'vitest';
import { Group } from './Group';
import { RectangleNode } from './nodes/RectangleNode';
import { StyleManager } from '@/styles/StyleManager';
import { mockCanvasContext } from '@/test/testUtils';

describe('Group', () => {
  it('recalculates bounds from children', () => {
    const group = new Group({ padding: 10 });
    const first = new RectangleNode({ x: 0, y: 0, width: 50, height: 40 });
    const second = new RectangleNode({ x: 100, y: 80, width: 20, height: 10 });

    group.addChild(first);
    group.addChild(second);

    const bounds = group.getBounds();
    expect(bounds.x).toBe(-10);
    expect(bounds.y).toBe(-10);
    expect(bounds.width).toBe(140);
    expect(bounds.height).toBe(110);
  });

  it('removes children by id', () => {
    const group = new Group();
    const node = new RectangleNode({ x: 0, y: 0, width: 10, height: 10 });
    group.addChild(node);

    expect(group.removeChild(node.id)).toBe(true);
    expect(group.children.length).toBe(0);
  });

  it('draws only group chrome and leaves child rendering to the renderer', () => {
    const ctx = mockCanvasContext();
    const group = new Group();
    const node = new RectangleNode({ x: 0, y: 0, width: 10, height: 10 });
    const renderChild = vi.spyOn(node, 'render');
    group.addChild(node);

    group.render(ctx);

    expect(ctx.fillRect).toHaveBeenCalled();
    expect(ctx.strokeRect).toHaveBeenCalled();
    expect(renderChild).not.toHaveBeenCalled();
  });

  it('applies the selected group theme style', () => {
    const group = new Group();
    group.state = 'selected';

    group.applyStyleManager(new StyleManager());

    expect(group.style).toMatchObject({
      fillColor: 'rgba(59, 130, 246, 0.1)',
      strokeColor: '#3b82f6',
      strokeWidth: 2,
    });
  });
});
