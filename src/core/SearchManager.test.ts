import { describe, it, expect, beforeEach } from 'vitest';
import { DiagramRenderer } from './DiagramRenderer';
import { SearchManager } from './SearchManager';
import { RectangleNode } from '../elements/nodes/RectangleNode';
import { Edge } from '../elements/Edge';
import { stubCanvasContext, stubAnimationFrame } from '../test/testUtils';

describe('SearchManager', () => {
  beforeEach(() => {
    stubCanvasContext();
    stubAnimationFrame();
  });

  it('finds nodes and edges by label', () => {
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, { width: 200, height: 100, retina: false });
    const nodeA = new RectangleNode({
      x: 0,
      y: 0,
      width: 40,
      height: 20,
      label: 'Alpha',
    });
    const nodeB = new RectangleNode({
      x: 60,
      y: 0,
      width: 40,
      height: 20,
      label: 'Beta',
    });
    renderer.addNode(nodeA);
    renderer.addNode(nodeB);
    const edge = new Edge({
      from: { nodeId: nodeA.id },
      to: { nodeId: nodeB.id },
      label: 'Alpha -> Beta',
    });
    edge.updateEndpoints({ x: 0, y: 0 }, { x: 60, y: 0 });
    renderer.addEdge(edge);

    const search = new SearchManager(renderer);
    const result = search.find('alpha');

    expect(result.matches.length).toBe(2);
    expect(result.nodes.length).toBe(1);
    expect(result.edges.length).toBe(1);
  });

  it('filters nodes by type and style class', () => {
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, { width: 200, height: 100, retina: false });
    const nodeA = new RectangleNode({
      x: 0,
      y: 0,
      width: 40,
      height: 20,
      label: 'Alpha',
      styleClass: 'primary',
    });
    const nodeB = new RectangleNode({
      x: 60,
      y: 0,
      width: 40,
      height: 20,
      label: 'Beta',
      styleClass: 'secondary',
    });
    renderer.addNode(nodeA);
    renderer.addNode(nodeB);

    const search = new SearchManager(renderer);
    search.filter({ nodeType: 'RectangleNode', styleClass: 'primary' });

    expect(nodeA.visible).toBe(true);
    expect(nodeB.visible).toBe(false);

    search.clearFilter();
    expect(nodeA.visible).toBe(true);
    expect(nodeB.visible).toBe(true);
  });
});
