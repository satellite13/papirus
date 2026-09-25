import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DiagramRenderer } from './DiagramRenderer';
import { SelectionManager } from './SelectionManager';
import { ResizeManager } from './ResizeManager';
import { CompositeNode } from '../elements/composite/CompositeNode';
import { container, text } from '../elements/composite';
import { mockCanvasContext, stubAnimationFrame } from '../test/testUtils';
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

describe('ResizeManager', () => {
  beforeEach(() => {
    stubAnimationFrame();
  });

  function setup(): { resize: ResizeManager; node: CompositeNode } {
    // Length-based text measurement so wrapped width/height are deterministic.
    const ctx = mockCanvasContext();
    ctx.measureText = vi.fn((text: string) => ({ width: text.length * 10 }));
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ctx);

    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, { width: 400, height: 300, retina: false });
    const selection = new SelectionManager(renderer);
    const resize = new ResizeManager({ renderer, selectionManager: selection });

    const node = new CompositeNode({
      id: 'c1',
      x: 0,
      y: 0,
      width: 130,
      height: 40,
      content: container({
        direction: 'column',
        children: [text({ text: 'one two three' })],
      }),
    });
    renderer.addNode(node);
    selection.select(node.id);
    return { resize, node };
  }

  it('clamps width to the longest-word floor and grows min height while narrowing', () => {
    const { resize, node } = setup();

    // 'se' handle sits at (width + offset, height + offset) = (136, 46);
    // width = start.width + dx, so worldX 66 → width 60.
    expect(resize.handleMouseDown(mouseEvent(136, 46))).toBe(true);
    resize.handleMouseMove(mouseEvent(66, 46));

    // Width narrows to 60 (floor for 'three' is 50); height grows to 3 wrapped lines.
    expect(node.width).toBe(60);
    expect(node.height).toBeCloseTo(3 * 14 * 1.2);
  });

  it('recomputes min height when the node is widened again', () => {
    const { resize, node } = setup();

    resize.handleMouseDown(mouseEvent(136, 46));
    resize.handleMouseMove(mouseEvent(66, 46));
    resize.handleMouseMove(mouseEvent(106, 46));

    expect(node.width).toBe(100);
    expect(node.height).toBe(40);
  });
});
