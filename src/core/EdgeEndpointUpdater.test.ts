import { beforeEach, describe, expect, it } from 'vitest';
import { Edge } from '@/elements/Edge';
import { RectangleNode } from '@/elements/nodes/RectangleNode';
import { stubAnimationFrame, stubCanvasContext } from '@/test/testUtils';
import { DiagramRenderer } from './DiagramRenderer';

describe('EdgeEndpointUpdater edge attachments', () => {
  beforeEach(() => {
    stubCanvasContext();
    stubAnimationFrame();
  });

  it('with lockAnchors off attaches to border ports, not node centers', () => {
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, { width: 400, height: 300, retina: false });
    const a = new RectangleNode({ id: 'a', x: 0, y: 40, width: 40, height: 40 });
    const b = new RectangleNode({ id: 'b', x: 200, y: 40, width: 40, height: 40 });
    renderer.addNode(a);
    renderer.addNode(b);

    const edge = new Edge({
      id: 'e1',
      from: { nodeId: 'a' },
      to: { nodeId: 'b' },
      type: 'straight',
      lockAnchors: false,
    });
    renderer.addEdge(edge);
    renderer.render();

    const start = edge.path[0]!;
    const end = edge.path[edge.path.length - 1]!;
    const aCenter = a.getCenter();
    const bCenter = b.getCenter();

    expect(start.x).not.toBeCloseTo(aCenter.x, 0);
    expect(start.y).toBeCloseTo(aCenter.y, 0);
    expect(start.x).toBeCloseTo(a.x + a.width, 0);

    expect(end.x).not.toBeCloseTo(bCenter.x, 0);
    expect(end.y).toBeCloseTo(bCenter.y, 0);
    expect(end.x).toBeCloseTo(b.x, 0);
  });

  it('with lockAnchors off ignores stored portId and retargets after node move', () => {
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, { width: 500, height: 400, retina: false });
    const a = new RectangleNode({ id: 'a', x: 0, y: 100, width: 40, height: 40 });
    const b = new RectangleNode({ id: 'b', x: 200, y: 100, width: 40, height: 40 });
    renderer.addNode(a);
    renderer.addNode(b);

    const edge = new Edge({
      id: 'e1',
      // Stale locked side — should be ignored while unlocked.
      from: { nodeId: 'a', portId: 'anchor:left:1' },
      to: { nodeId: 'b', portId: 'anchor:right:1' },
      type: 'straight',
      lockAnchors: false,
    });
    renderer.addEdge(edge);
    renderer.render();

    // Horizontally, unlocked ends should face each other (right of A, left of B).
    expect(edge.path[0]!.x).toBeCloseTo(a.x + a.width, 0);
    expect(edge.path[edge.path.length - 1]!.x).toBeCloseTo(b.x, 0);

    // Move B directly above A — floating end on A should switch to top.
    b.x = 0;
    b.y = -120;
    renderer.updateEdgeEndpointsForDrag();

    expect(edge.path[0]!.y).toBeCloseTo(a.y, 0);
    expect(edge.path[0]!.x).toBeCloseTo(a.getCenter().x, 0);
  });

  it('places a junction endpoint on the host edge path', () => {
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, { width: 400, height: 300, retina: false });
    const a = new RectangleNode({ id: 'a', x: 0, y: 40, width: 40, height: 40 });
    const b = new RectangleNode({ id: 'b', x: 200, y: 40, width: 40, height: 40 });
    const c = new RectangleNode({ id: 'c', x: 100, y: 160, width: 40, height: 40 });
    renderer.addNode(a);
    renderer.addNode(b);
    renderer.addNode(c);

    const host = new Edge({
      id: 'host',
      from: { nodeId: 'a' },
      to: { nodeId: 'b' },
      type: 'straight',
    });
    const junction = new Edge({
      id: 'junction',
      from: { nodeId: 'c' },
      to: { edgeId: 'host', pathParam: 0.5 },
      type: 'straight',
      arrowType: 'none',
    });
    renderer.addEdge(host);
    renderer.addEdge(junction);
    renderer.render();

    const hostMid = host.getPointAt(0.5)?.point;
    expect(hostMid).toBeTruthy();
    const tip = junction.path[junction.path.length - 1]!;
    expect(tip.x).toBeCloseTo(hostMid!.x, 0);
    expect(tip.y).toBeCloseTo(hostMid!.y, 0);
  });
});
