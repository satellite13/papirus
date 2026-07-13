import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DiagramRenderer } from './DiagramRenderer';
import { SelectionManager } from './SelectionManager';
import { DragManager } from './DragManager';
import { RectangleNode } from '../elements/nodes/RectangleNode';
import { stubCanvasContext, stubAnimationFrame } from '../test/testUtils';
import type { InputEvent } from '../events/InputHandler';

function mouseEvent(
  worldX: number,
  worldY: number,
  overrides: Partial<InputEvent> = {}
): InputEvent {
  return {
    screenX: worldX,
    screenY: worldY,
    worldX,
    worldY,
    button: 0,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
    originalEvent: new MouseEvent('mousedown'),
    ...overrides,
  };
}

describe('DragManager', () => {
  beforeEach(() => {
    stubCanvasContext();
    stubAnimationFrame();
  });

  it('drags a selected node past the start threshold', () => {
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, { width: 400, height: 300, retina: false });
    const selection = new SelectionManager(renderer);
    const drag = new DragManager({
      renderer,
      selectionManager: selection,
      alignToNodes: false,
    });

    const node = new RectangleNode({ id: 'n1', x: 50, y: 50, width: 40, height: 30 });
    renderer.addNode(node);
    selection.select(node.id);

    const dragstart = vi.fn();
    const dragMove = vi.fn();
    const dragend = vi.fn();
    drag.on('dragstart', dragstart);
    drag.on('drag', dragMove);
    drag.on('dragend', dragend);

    drag.handleMouseDown(mouseEvent(60, 60));
    drag.handleMouseMove(mouseEvent(80, 70));
    expect(dragstart).toHaveBeenCalled();
    expect(drag.dragging).toBe(true);

    drag.handleMouseMove(mouseEvent(100, 90));
    expect(dragMove).toHaveBeenCalled();
    expect(node.x).toBeGreaterThan(50);

    drag.handleMouseUp(mouseEvent(100, 90));
    expect(dragend).toHaveBeenCalled();
    expect(drag.dragging).toBe(false);
  });

  it('snaps to grid when enabled', () => {
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, { width: 400, height: 300, retina: false });
    const selection = new SelectionManager(renderer);
    const drag = new DragManager({
      renderer,
      selectionManager: selection,
      snapToGrid: true,
      gridSize: 20,
      alignToNodes: false,
    });

    const node = new RectangleNode({ id: 'n1', x: 40, y: 40, width: 20, height: 20 });
    renderer.addNode(node);
    selection.select(node.id);

    drag.handleMouseDown(mouseEvent(45, 45));
    drag.handleMouseMove(mouseEvent(58, 53));
    drag.handleMouseMove(mouseEvent(67, 61));
    drag.handleMouseUp(mouseEvent(67, 61));

    expect(node.x % 20).toBe(0);
    expect(node.y % 20).toBe(0);
  });
});
