import { beforeEach, describe, expect, it } from 'vitest';
import { DiagramRenderer } from '../core/DiagramRenderer';
import { RectangleNode } from '../elements/nodes/RectangleNode';
import { Edge } from '../elements/Edge';
import { AutoRouting } from './AutoRouting';
import { stubAnimationFrame, stubCanvasContext } from '../test/testUtils';

describe('AutoRouting.apply', () => {
  beforeEach(() => {
    stubCanvasContext();
    stubAnimationFrame();
  });

  it('updates edge type and path', () => {
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, { width: 300, height: 200 });

    const nodeA = new RectangleNode({ x: 10, y: 10, width: 50, height: 40 });
    const nodeB = new RectangleNode({ x: 200, y: 100, width: 50, height: 40 });
    renderer.addNode(nodeA);
    renderer.addNode(nodeB);

    const edge = new Edge({ from: { nodeId: nodeA.id }, to: { nodeId: nodeB.id }, type: 'straight' });
    renderer.addEdge(edge);

    const routing = new AutoRouting();
    routing.apply(renderer, { type: 'bezier' });

    expect(edge.type).toBe('bezier');
    expect(edge.path.length).toBeGreaterThan(1);

    renderer.destroy();
  });
});
