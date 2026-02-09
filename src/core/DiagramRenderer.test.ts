import { describe, it, expect, beforeEach } from 'vitest';
import { DiagramRenderer } from './DiagramRenderer';
import { RectangleNode } from '../elements/nodes/RectangleNode';
import { stubCanvasContext, stubAnimationFrame } from '../test/testUtils';

describe('DiagramRenderer', () => {
  beforeEach(() => {
    stubCanvasContext();
    stubAnimationFrame();
  });

  it('registers nodes and listens to element dirty state', () => {
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, { width: 200, height: 100, retina: false });
    const node = new RectangleNode({ x: 0, y: 0, width: 10, height: 10 });

    renderer.addNode(node);
    (renderer as unknown as { _dirty: boolean })._dirty = false;

    node.x = 20;

    expect((renderer as unknown as { _dirty: boolean })._dirty).toBe(true);
  });
});
