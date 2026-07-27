import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Edge } from '@/elements/Edge';
import type { PathObstacle } from '@/elements/paths';
import { RectangleNode } from '@/elements/nodes/RectangleNode';
import { stubAnimationFrame, stubCanvasContext } from '@/test/testUtils';
import { isNodeEdgeEndpoint } from '@/types';
import { DiagramRenderer } from './DiagramRenderer';
import { EdgeEndpointUpdater } from './EdgeEndpointUpdater';

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

  it('passes parent and target obstacles with role target, excludes source', () => {
    const comp = new RectangleNode({ id: 'comp', x: 180, y: 240, width: 140, height: 80 });
    const bp = new RectangleNode({ id: 'bp', x: 40, y: 40, width: 400, height: 50 });
    const parent = new RectangleNode({ id: 'parent', x: 160, y: 200, width: 220, height: 160 });

    const nodes = new Map([
      ['comp', comp],
      ['bp', bp],
      ['parent', parent],
    ]);

    const edge = new Edge({
      id: 'e1',
      from: { nodeId: 'comp' },
      to: { nodeId: 'bp' },
      type: 'polyline',
    });
    const edges = new Map([['e1', edge]]);

    const obstacles: PathObstacle[] = [
      {
        id: 'comp',
        x: comp.x - 8,
        y: comp.y - 8,
        width: comp.width + 16,
        height: comp.height + 16,
        role: 'other',
      },
      {
        id: 'bp',
        x: bp.x - 8,
        y: bp.y - 8,
        width: bp.width + 16,
        height: bp.height + 16,
        role: 'other',
      },
      {
        id: 'parent',
        x: parent.x - 8,
        y: parent.y - 8,
        width: parent.width + 16,
        height: parent.height + 16,
        role: 'other',
      },
    ];

    const updater = new EdgeEndpointUpdater({
      getNodes: () => nodes,
      getEdges: () => edges,
      getNodeObstacles: () => obstacles,
    });

    const spy = vi.spyOn(edge, 'updateEndpoints');
    updater.updateAll();

    expect(spy).toHaveBeenCalled();
    const passed = spy.mock.calls[0]![4]?.obstacles;
    expect(passed).toBeDefined();
    const source = passed!.find((o) => o.id === 'comp');
    expect(source).toBeDefined();
    expect(source!.role).toBe('source');
    expect(passed!.find((o) => o.id === 'parent')).toBeDefined();
    const target = passed!.find((o) => o.id === 'bp');
    expect(target).toBeDefined();
    expect(target!.role).toBe('target');
  });

  it('assigns facing bottom/top when target port is unset on a vertical stack', () => {
    const product = new RectangleNode({ id: 'product', x: 200, y: 240, width: 140, height: 80 });
    const bp = new RectangleNode({ id: 'bp', x: 40, y: 40, width: 400, height: 50 });
    const nodes = new Map([
      ['product', product],
      ['bp', bp],
    ]);

    const edge = new Edge({
      id: 'e-stack',
      from: { nodeId: 'product', portId: 'anchor:top:0' },
      // Unset target — prefer facing side instead of nearest-anchor left on a wide BP.
      to: { nodeId: 'bp' },
      type: 'polyline',
      lockAnchors: true,
    });
    const edges = new Map([['e-stack', edge]]);

    const pad = 4;
    const obstacles: PathObstacle[] = [
      {
        id: 'product',
        x: product.x - pad,
        y: product.y - pad,
        width: product.width + pad * 2,
        height: product.height + pad * 2,
        role: 'other',
      },
      {
        id: 'bp',
        x: bp.x - pad,
        y: bp.y - pad,
        width: bp.width + pad * 2,
        height: bp.height + pad * 2,
        role: 'other',
      },
    ];

    const updater = new EdgeEndpointUpdater({
      getNodes: () => nodes,
      getEdges: () => edges,
      getNodeObstacles: () => obstacles,
    });
    updater.updateAll();

    expect(isNodeEdgeEndpoint(edge.to)).toBe(true);
    if (isNodeEdgeEndpoint(edge.to)) {
      expect(edge.to.portId?.startsWith('anchor:bottom:')).toBe(true);
    }
    expect(isNodeEdgeEndpoint(edge.from)).toBe(true);
    if (isNodeEdgeEndpoint(edge.from)) {
      expect(edge.from.portId).toBe('anchor:top:0');
    }

    const end = edge.path[edge.path.length - 1]!;
    expect(end.y).toBeCloseTo(bp.y + bp.height, 0);
    // Horizontal mid segments should sit below BP, not at left-port Y on the contour.
    for (let i = 1; i < edge.path.length; i++) {
      const a = edge.path[i - 1]!;
      const b = edge.path[i]!;
      if (Math.abs(a.y - b.y) < 0.5 && Math.abs(a.x - b.x) > 1) {
        expect(a.y).toBeGreaterThan(bp.y + bp.height - 1);
      }
    }
  });

  it('keeps user port on a lateral side after reconnect (no snap to facing)', () => {
    const os = new RectangleNode({ id: 'os', x: 80, y: 150, width: 200, height: 60 });
    const device = new RectangleNode({ id: 'device', x: 80, y: 240, width: 200, height: 60 });
    const nodes = new Map([
      ['os', os],
      ['device', device],
    ]);

    // Port-mode reconnect (attachToOutline off) locks a side port — must not snap to top/bottom.
    const edge = new Edge({
      id: 'e-port-lateral',
      from: { nodeId: 'device', portId: 'anchor:top:0' },
      to: { nodeId: 'os', portId: 'anchor:right:0' },
      type: 'polyline',
      lockAnchors: true,
    });
    const edges = new Map([['e-port-lateral', edge]]);

    const updater = new EdgeEndpointUpdater({
      getNodes: () => nodes,
      getEdges: () => edges,
      getNodeObstacles: () => [],
    });
    updater.updateAll();
    updater.updateAll();

    expect(isNodeEdgeEndpoint(edge.to)).toBe(true);
    if (isNodeEdgeEndpoint(edge.to)) {
      expect(edge.to.portId?.startsWith('anchor:right:')).toBe(true);
    }
  });

  it('keeps intentional bottom→bottom wrap on a vertical stack', () => {
    const os = new RectangleNode({ id: 'os', x: 80, y: 150, width: 200, height: 60 });
    const device = new RectangleNode({ id: 'device', x: 80, y: 240, width: 200, height: 60 });
    const nodes = new Map([
      ['os', os],
      ['device', device],
    ]);

    const edge = new Edge({
      id: 'e-serving',
      from: { nodeId: 'device', portId: 'anchor:bottom:0' },
      to: { nodeId: 'os', portId: 'anchor:bottom:0' },
      type: 'polyline',
      lockAnchors: true,
    });
    const edges = new Map([['e-serving', edge]]);

    const updater = new EdgeEndpointUpdater({
      getNodes: () => nodes,
      getEdges: () => edges,
      getNodeObstacles: () => [
        { id: 'os', x: os.x, y: os.y, width: os.width, height: os.height, role: 'other' },
        {
          id: 'device',
          x: device.x,
          y: device.y,
          width: device.width,
          height: device.height,
          role: 'other',
        },
      ],
    });
    updater.updateAll();

    expect(isNodeEdgeEndpoint(edge.from)).toBe(true);
    expect(isNodeEdgeEndpoint(edge.to)).toBe(true);
    if (isNodeEdgeEndpoint(edge.from) && isNodeEdgeEndpoint(edge.to)) {
      expect(edge.from.portId?.startsWith('anchor:bottom:')).toBe(true);
      expect(edge.to.portId?.startsWith('anchor:bottom:')).toBe(true);
    }

    const start = edge.path[0]!;
    const end = edge.path[edge.path.length - 1]!;
    expect(start.y).toBeCloseTo(device.y + device.height, 0);
    expect(end.y).toBeCloseTo(os.y + os.height, 0);

    // Mid segments must not cut open interiors of either endpoint.
    for (let i = 1; i < edge.path.length; i++) {
      const a = edge.path[i - 1]!;
      const b = edge.path[i]!;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const inOs =
        mid.x > os.x && mid.x < os.x + os.width && mid.y > os.y && mid.y < os.y + os.height;
      const inDevice =
        mid.x > device.x &&
        mid.x < device.x + device.width &&
        mid.y > device.y &&
        mid.y < device.y + device.height;
      expect(inOs || inDevice).toBe(false);
    }
  });

  it('keeps outlineParam same-side bottoms on a vertical stack', () => {
    const os = new RectangleNode({ id: 'os', x: 80, y: 150, width: 200, height: 60 });
    const device = new RectangleNode({ id: 'device', x: 80, y: 240, width: 200, height: 60 });
    const nodes = new Map([
      ['os', os],
      ['device', device],
    ]);

    // peri = 2*(200+60)=520; bottom starts after top+right = 260 → param ≈ 0.69.
    const edge = new Edge({
      id: 'e-outline-serving',
      from: { nodeId: 'device', outlineParam: 0.7 },
      to: { nodeId: 'os', outlineParam: 0.7 },
      type: 'polyline',
      lockAnchors: true,
    });
    const edges = new Map([['e-outline-serving', edge]]);

    const updater = new EdgeEndpointUpdater({
      getNodes: () => nodes,
      getEdges: () => edges,
      getNodeObstacles: () => [],
    });
    updater.updateAll();

    expect(isNodeEdgeEndpoint(edge.from)).toBe(true);
    expect(isNodeEdgeEndpoint(edge.to)).toBe(true);
    if (isNodeEdgeEndpoint(edge.from) && isNodeEdgeEndpoint(edge.to)) {
      expect(edge.from.outlineParam).toBeCloseTo(0.7, 5);
      expect(edge.to.outlineParam).toBeCloseTo(0.7, 5);
      expect(edge.from.portId).toBeUndefined();
      expect(edge.to.portId).toBeUndefined();
    }
  });

  it('keeps intentional bottom→top on a vertical stack (no snap to facing)', () => {
    // Device below OS: user places source on bottom and target on top (wrap under).
    const os = new RectangleNode({ id: 'os', x: 80, y: 150, width: 200, height: 60 });
    const device = new RectangleNode({ id: 'device', x: 80, y: 240, width: 200, height: 60 });
    const nodes = new Map([
      ['os', os],
      ['device', device],
    ]);

    const edge = new Edge({
      id: 'e-bottom-top',
      from: { nodeId: 'device', portId: 'anchor:bottom:0' },
      to: { nodeId: 'os', portId: 'anchor:top:0' },
      type: 'polyline',
      lockAnchors: true,
    });
    const edges = new Map([['e-bottom-top', edge]]);

    const updater = new EdgeEndpointUpdater({
      getNodes: () => nodes,
      getEdges: () => edges,
      getNodeObstacles: () => [
        { id: 'os', x: os.x, y: os.y, width: os.width, height: os.height, role: 'other' },
        {
          id: 'device',
          x: device.x,
          y: device.y,
          width: device.width,
          height: device.height,
          role: 'other',
        },
      ],
    });
    updater.updateAll();

    expect(isNodeEdgeEndpoint(edge.from)).toBe(true);
    expect(isNodeEdgeEndpoint(edge.to)).toBe(true);
    if (isNodeEdgeEndpoint(edge.from) && isNodeEdgeEndpoint(edge.to)) {
      expect(edge.from.portId?.startsWith('anchor:bottom:')).toBe(true);
      expect(edge.to.portId?.startsWith('anchor:top:')).toBe(true);
    }
  });

  it('keeps user outline on target top (wrap-around, no snap to facing bottom)', () => {
    const os = new RectangleNode({ id: 'os', x: 80, y: 150, width: 200, height: 60 });
    const device = new RectangleNode({ id: 'device', x: 80, y: 240, width: 200, height: 60 });
    const nodes = new Map([
      ['os', os],
      ['device', device],
    ]);

    // peri=520; top edge param in [0, 200/520) ≈ 0.2
    const edge = new Edge({
      id: 'e-wrap-top',
      from: { nodeId: 'device', portId: 'anchor:top:0' },
      to: { nodeId: 'os', outlineParam: 0.2 },
      type: 'polyline',
      lockAnchors: true,
    });
    const edges = new Map([['e-wrap-top', edge]]);

    const updater = new EdgeEndpointUpdater({
      getNodes: () => nodes,
      getEdges: () => edges,
      getNodeObstacles: () => [
        { id: 'os', x: os.x, y: os.y, width: os.width, height: os.height, role: 'other' },
        {
          id: 'device',
          x: device.x,
          y: device.y,
          width: device.width,
          height: device.height,
          role: 'other',
        },
      ],
    });
    updater.updateAll();

    expect(isNodeEdgeEndpoint(edge.to)).toBe(true);
    if (isNodeEdgeEndpoint(edge.to)) {
      expect(edge.to.outlineParam).toBeCloseTo(0.2, 5);
      expect(edge.to.portId).toBeUndefined();
    }
    // Path must go around OS, not through it.
    for (let i = 1; i < edge.path.length - 1; i++) {
      const p = edge.path[i]!;
      const inOs =
        p.x > os.x && p.x < os.x + os.width && p.y > os.y && p.y < os.y + os.height;
      expect(inOs).toBe(false);
    }
  });

  it('keeps user outline on a lateral side after reconnect', () => {
    const os = new RectangleNode({ id: 'os', x: 80, y: 150, width: 200, height: 60 });
    const device = new RectangleNode({ id: 'device', x: 80, y: 240, width: 200, height: 60 });
    const nodes = new Map([
      ['os', os],
      ['device', device],
    ]);

    // peri=520; right edge after top(200) → param in (200/520, 260/520) ≈ 0.42
    const edge = new Edge({
      id: 'e-lateral',
      from: { nodeId: 'device', portId: 'anchor:top:0' },
      to: { nodeId: 'os', outlineParam: 0.42 },
      type: 'polyline',
      lockAnchors: true,
    });
    const edges = new Map([['e-lateral', edge]]);

    const updater = new EdgeEndpointUpdater({
      getNodes: () => nodes,
      getEdges: () => edges,
      getNodeObstacles: () => [],
    });
    updater.updateAll();

    expect(isNodeEdgeEndpoint(edge.to)).toBe(true);
    if (isNodeEdgeEndpoint(edge.to)) {
      expect(edge.to.outlineParam).toBeCloseTo(0.42, 5);
    }
  });

  it('keeps user outline on facing side (no snap-back after reconnect)', () => {
    const os = new RectangleNode({ id: 'os', x: 80, y: 150, width: 200, height: 60 });
    const device = new RectangleNode({ id: 'device', x: 80, y: 240, width: 200, height: 60 });
    const nodes = new Map([
      ['os', os],
      ['device', device],
    ]);

    // Facing top→bottom; user slid the OS end along the bottom edge.
    const edge = new Edge({
      id: 'e-slide',
      from: { nodeId: 'device', portId: 'anchor:top:0' },
      to: { nodeId: 'os', outlineParam: 0.72 },
      type: 'polyline',
      lockAnchors: true,
    });
    const edges = new Map([['e-slide', edge]]);

    const updater = new EdgeEndpointUpdater({
      getNodes: () => nodes,
      getEdges: () => edges,
      getNodeObstacles: () => [],
    });
    updater.updateAll();
    updater.updateAll();

    expect(isNodeEdgeEndpoint(edge.to)).toBe(true);
    if (isNodeEdgeEndpoint(edge.to)) {
      expect(edge.to.outlineParam).toBeCloseTo(0.72, 5);
      expect(edge.to.portId).toBeUndefined();
    }
    if (isNodeEdgeEndpoint(edge.from)) {
      expect(edge.from.portId).toBe('anchor:top:0');
    }
  });

  it('keeps bottom target when source is offset far left but still below', () => {
    const product = new RectangleNode({ id: 'product', x: -80, y: 240, width: 140, height: 80 });
    const bp = new RectangleNode({ id: 'bp', x: 40, y: 40, width: 400, height: 50 });
    const nodes = new Map([
      ['product', product],
      ['bp', bp],
    ]);

    const edge = new Edge({
      id: 'e-left-offset',
      from: { nodeId: 'product', portId: 'anchor:top:0' },
      // Already facing — must not flip to left just because |dx| > |dy|.
      to: { nodeId: 'bp', portId: 'anchor:bottom:0' },
      type: 'polyline',
      lockAnchors: true,
    });
    const edges = new Map([['e-left-offset', edge]]);

    const updater = new EdgeEndpointUpdater({
      getNodes: () => nodes,
      getEdges: () => edges,
      getNodeObstacles: () => [],
    });
    updater.updateAll();

    expect(isNodeEdgeEndpoint(edge.to)).toBe(true);
    if (isNodeEdgeEndpoint(edge.to)) {
      expect(edge.to.portId?.startsWith('anchor:bottom:')).toBe(true);
    }
    expect(edge.path[edge.path.length - 1]!.y).toBeCloseTo(bp.y + bp.height, 0);
  });

  it('keeps parent container as obstacle so nested edge routes around it', () => {
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, { width: 600, height: 500, retina: false });
    const bp = new RectangleNode({ id: 'bp', x: 40, y: 40, width: 400, height: 50 });
    const parent = new RectangleNode({ id: 'parent', x: 160, y: 200, width: 220, height: 160 });
    const comp = new RectangleNode({ id: 'comp', x: 180, y: 240, width: 140, height: 80 });
    renderer.addNode(bp);
    renderer.addNode(parent);
    renderer.addNode(comp);

    const edge = new Edge({
      id: 'e-nested',
      from: { nodeId: 'comp', portId: 'anchor:left:0' },
      to: { nodeId: 'bp', portId: 'anchor:bottom:0' },
      type: 'polyline',
      lockAnchors: true,
    });
    renderer.addEdge(edge);
    renderer.render();

    const path = edge.path;
    const start = path[0]!;
    const end = path[path.length - 1]!;
    expect(start.x).toBeCloseTo(comp.x, 0);
    expect(end.y).toBeCloseTo(bp.y + bp.height, 0);

    // Path midpoints after the exit stub should not pierce parent interior.
    const inset = {
      x: parent.x + 6,
      y: parent.y + 6,
      w: parent.width - 12,
      h: parent.height - 12,
    };
    for (let i = 2; i < path.length; i++) {
      const a = path[i - 1]!;
      const b = path[i]!;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const inside =
        mid.x > inset.x &&
        mid.x < inset.x + inset.w &&
        mid.y > inset.y &&
        mid.y < inset.y + inset.h;
      expect(inside).toBe(false);
    }
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
