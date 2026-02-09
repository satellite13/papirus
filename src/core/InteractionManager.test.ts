import { describe, it, expect, beforeEach } from 'vitest';
import { DiagramRenderer } from './DiagramRenderer';
import { InteractionManager } from './InteractionManager';
import { RectangleNode } from '../elements/nodes/RectangleNode';
import { stubCanvasContext, stubAnimationFrame } from '../test/testUtils';

describe('InteractionManager', () => {
  beforeEach(() => {
    stubCanvasContext();
    stubAnimationFrame();
  });

  it('deletes selected nodes on Delete key', () => {
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, { width: 200, height: 100, retina: false });
    const interaction = new InteractionManager({ renderer });

    const node = new RectangleNode({ x: 10, y: 10, width: 20, height: 20 });
    renderer.addNode(node);

    interaction.selection.select(node.id);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }));

    expect(renderer.getNode(node.id)).toBeUndefined();
  });
});
