import { describe, it, expect } from 'vitest';
import { Edge } from './Edge';

describe('Edge', () => {
  it('recalculates path and hit tests', () => {
    const edge = new Edge({
      from: { nodeId: 'a' },
      to: { nodeId: 'b' },
      type: 'straight',
    });

    edge.updateEndpoints({ x: 0, y: 0 }, { x: 100, y: 0 });
    expect(edge.path.length).toBe(2);
    expect(edge.hitTest({ x: 50, y: 0 })).toBe(true);
  });

  it('uses bezier strategy when set', () => {
    const edge = new Edge({
      from: { nodeId: 'a' },
      to: { nodeId: 'b' },
      type: 'bezier',
    });

    edge.updateEndpoints({ x: 0, y: 0 }, { x: 100, y: 40 });
    expect(edge.path.length).toBe(4);
  });

  it('builds an outer self-loop for bezier edges', () => {
    const edge = new Edge({
      from: { nodeId: 'a', portId: 'anchor:top:1' },
      to: { nodeId: 'a', portId: 'anchor:top:1' },
      type: 'bezier',
    });

    edge.updateEndpoints(
      { x: 100, y: 100 },
      { x: 100, y: 100 },
      'top',
      'top'
    );

    expect(edge.path.length).toBe(4);
    expect(edge.path[0]).toEqual({ x: 100, y: 100 });
    expect(edge.path[3]).toEqual({ x: 100, y: 100 });
    expect(edge.path[1]!.y).toBeLessThan(100);
    expect(edge.path[2]!.y).toBeLessThan(100);
  });

  it('routes close orthogonal bezier anchors around outer corner', () => {
    const edge = new Edge({
      from: { nodeId: 'a', portId: 'anchor:left:1' },
      to: { nodeId: 'a', portId: 'anchor:bottom:1' },
      type: 'bezier',
    });

    edge.updateEndpoints(
      { x: 100, y: 120 }, // left anchor
      { x: 130, y: 150 }, // bottom anchor
      'left',
      'bottom'
    );

    expect(edge.path.length).toBe(4);
    // Both control points should stay outside the node corner area.
    expect(edge.path[1]!.x).toBeLessThan(100);
    expect(edge.path[2]!.y).toBeGreaterThan(150);
  });

  it('routes close opposite bezier anchors outside the node', () => {
    const edge = new Edge({
      from: { nodeId: 'a', portId: 'anchor:left:1' },
      to: { nodeId: 'a', portId: 'anchor:right:1' },
      type: 'bezier',
    });

    edge.updateEndpoints(
      { x: 100, y: 120 }, // left anchor
      { x: 160, y: 120 }, // right anchor
      'left',
      'right'
    );

    expect(edge.path.length).toBe(4);
    // Both control points should be shifted vertically to create an outer arc.
    expect(edge.path[1]!.y).toBeLessThan(120);
    expect(edge.path[2]!.y).toBeLessThan(120);
  });

  it('routes close opposite polyline anchors outside the node', () => {
    const edge = new Edge({
      from: { nodeId: 'a', portId: 'anchor:left:1' },
      to: { nodeId: 'a', portId: 'anchor:right:1' },
      type: 'polyline',
    });

    edge.updateEndpoints(
      { x: 100, y: 120 },
      { x: 160, y: 120 },
      'left',
      'right'
    );

    expect(edge.path.length).toBe(6);
    // Route should rise above the node instead of crossing center line.
    expect(edge.path[2]!.y).toBeLessThan(120);
    expect(edge.path[3]!.y).toBeLessThan(120);
  });

  it('keeps default polyline routing for non-self-loop opposite anchors', () => {
    const edge = new Edge({
      from: { nodeId: 'a', portId: 'anchor:left:1' },
      to: { nodeId: 'b', portId: 'anchor:right:1' },
      type: 'polyline',
    });

    edge.updateEndpoints(
      { x: 100, y: 120 },
      { x: 160, y: 120 },
      'left',
      'right'
    );

    // No self-loop bypass: standard directed path shape.
    expect(edge.path.length).toBe(4);
  });

  it('routes polyline around obstacle rectangles', () => {
    const edge = new Edge({
      from: { nodeId: 'a', portId: 'anchor:right:1' },
      to: { nodeId: 'b', portId: 'anchor:left:1' },
      type: 'polyline',
    });

    edge.updateEndpoints(
      { x: 100, y: 120 },
      { x: 240, y: 120 },
      'right',
      'left',
      {
        obstacles: [
          { x: 150, y: 90, width: 40, height: 60 },
        ],
      }
    );

    expect(edge.path.length).toBeGreaterThan(4);
    // Route should detour vertically instead of crossing through obstacle band.
    expect(edge.path.some((p) => p.y < 90 || p.y > 150)).toBe(true);
  });

  it('routes close orthogonal polyline anchors around outer corner', () => {
    const edge = new Edge({
      from: { nodeId: 'a', portId: 'anchor:left:1' },
      to: { nodeId: 'a', portId: 'anchor:bottom:1' },
      type: 'polyline',
    });

    edge.updateEndpoints(
      { x: 100, y: 120 },
      { x: 130, y: 150 },
      'left',
      'bottom'
    );

    expect(edge.path.length).toBe(5);
    const corner = edge.path[2]!;
    expect(corner.x).toBeLessThan(100);
    expect(corner.y).toBeGreaterThan(150);
  });

  it('supports custom control points for bezier paths', () => {
    const edge = new Edge({
      from: { nodeId: 'a' },
      to: { nodeId: 'b' },
      type: 'bezier',
      controlPoints: [
        { x: 20, y: 0 },
        { x: 40, y: 0 },
        { x: 60, y: 0 },
      ],
    });

    edge.updateEndpoints({ x: 0, y: 0 }, { x: 60, y: 0 });
    expect(edge.path.length).toBe(4);
    expect(edge.path[edge.path.length - 1]).toEqual({ x: 60, y: 0 });
  });

  it('uses a midpoint handle for editable-polyline by default', () => {
    const edge = new Edge({
      from: { nodeId: 'a' },
      to: { nodeId: 'b' },
      type: 'editable-polyline',
    });

    edge.updateEndpoints({ x: 0, y: 0 }, { x: 100, y: 20 });
    expect(edge.path).toEqual([
      { x: 0, y: 0 },
      { x: 50, y: 10 },
      { x: 100, y: 20 },
    ]);
  });

  it('uses explicit control points for editable-polyline', () => {
    const edge = new Edge({
      from: { nodeId: 'a' },
      to: { nodeId: 'b' },
      type: 'editable-polyline',
      controlPoints: [
        { x: 40, y: 0 },
        { x: 60, y: 30 },
      ],
    });

    edge.updateEndpoints({ x: 0, y: 0 }, { x: 100, y: 20 });
    expect(edge.path).toEqual([
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 60, y: 30 },
      { x: 100, y: 20 },
    ]);
  });

  it('clears control points when switching from editable-polyline to another type', () => {
    const edge = new Edge({
      from: { nodeId: 'a' },
      to: { nodeId: 'b' },
      type: 'editable-polyline',
      controlPoints: [{ x: 50, y: 10 }, { x: 80, y: 20 }],
    });
    edge.updateEndpoints({ x: 0, y: 0 }, { x: 100, y: 0 });
    expect(edge.controlPoints).toHaveLength(2);

    edge.type = 'bezier';
    expect(edge.controlPoints).toBeUndefined();
    expect(edge.type).toBe('bezier');

    edge.type = 'straight';
    expect(edge.controlPoints).toBeUndefined();
  });

  describe('hasEditableControlPoints', () => {
    it('returns false for non-editable-polyline', () => {
      const edge = new Edge({
        from: { nodeId: 'a' },
        to: { nodeId: 'b' },
        type: 'straight',
      });
      expect(edge.hasEditableControlPoints()).toBe(false);
    });

    it('returns false for editable-polyline without materialized control points', () => {
      const edge = new Edge({
        from: { nodeId: 'a' },
        to: { nodeId: 'b' },
        type: 'editable-polyline',
      });
      edge.updateEndpoints({ x: 0, y: 0 }, { x: 100, y: 0 });
      expect(edge.hasEditableControlPoints()).toBe(false);
    });

    it('returns true for editable-polyline with control points', () => {
      const edge = new Edge({
        from: { nodeId: 'a' },
        to: { nodeId: 'b' },
        type: 'editable-polyline',
        controlPoints: [{ x: 50, y: 10 }],
      });
      edge.updateEndpoints({ x: 0, y: 0 }, { x: 100, y: 0 });
      expect(edge.hasEditableControlPoints()).toBe(true);
    });
  });

  describe('getPathVertices', () => {
    it('returns [start, ...controlPoints, end] for editable-polyline with control points', () => {
      const edge = new Edge({
        from: { nodeId: 'a' },
        to: { nodeId: 'b' },
        type: 'editable-polyline',
        controlPoints: [{ x: 40, y: 0 }, { x: 60, y: 30 }],
      });
      edge.updateEndpoints({ x: 0, y: 0 }, { x: 100, y: 20 });

      const vertices = edge.getPathVertices();
      expect(vertices).toHaveLength(4);
      expect(vertices[0]).toEqual({ x: 0, y: 0 });
      expect(vertices[1]).toEqual({ x: 40, y: 0 });
      expect(vertices[2]).toEqual({ x: 60, y: 30 });
      expect(vertices[3]).toEqual({ x: 100, y: 20 });
    });

    it('returns [start, virtualMidpoint, end] for editable-polyline without control points', () => {
      const edge = new Edge({
        from: { nodeId: 'a' },
        to: { nodeId: 'b' },
        type: 'editable-polyline',
      });
      edge.updateEndpoints({ x: 0, y: 0 }, { x: 100, y: 20 });

      const vertices = edge.getPathVertices();
      expect(vertices).toHaveLength(3);
      expect(vertices[0]).toEqual({ x: 0, y: 0 });
      expect(vertices[1]).toEqual({ x: 50, y: 10 });
      expect(vertices[2]).toEqual({ x: 100, y: 20 });
    });
  });

  describe('markers', () => {
    it('supports start and end marker configuration', () => {
      const edge = new Edge({
        from: { nodeId: 'a' },
        to: { nodeId: 'b' },
        startMarker: { type: 'circle', size: 6 },
        endMarker: { type: 'arrow', size: 12 },
      });

      expect(edge.startMarker).toEqual({ type: 'circle', size: 6 });
      expect(edge.endMarker).toEqual({ type: 'arrow', size: 12 });
    });

    it('can update markers after creation', () => {
      const edge = new Edge({
        from: { nodeId: 'a' },
        to: { nodeId: 'b' },
      });

      edge.startMarker = { type: 'diamond' };
      edge.endMarker = { type: 'none', size: 10 };

      expect(edge.startMarker?.type).toBe('diamond');
      expect(edge.endMarker?.type).toBe('none');
      expect(edge.endMarker?.size).toBe(10);
    });

    it('supports all marker types', () => {
      const types = ['none', 'arrow', 'open', 'diamond', 'circle'] as const;

      for (const type of types) {
        const edge = new Edge({
          from: { nodeId: 'a' },
          to: { nodeId: 'b' },
          endMarker: { type },
        });
        expect(edge.endMarker?.type).toBe(type);
      }
    });
  });

  describe('extended styles', () => {
    it('supports lineDashOffset', () => {
      const edge = new Edge({
        from: { nodeId: 'a' },
        to: { nodeId: 'b' },
        style: { lineDash: [5, 5], lineDashOffset: 10 },
      });

      expect(edge.style.lineDash).toEqual([5, 5]);
      expect(edge.style.lineDashOffset).toBe(10);
    });

    it('supports lineCap and lineJoin', () => {
      const edge = new Edge({
        from: { nodeId: 'a' },
        to: { nodeId: 'b' },
        style: { lineCap: 'round', lineJoin: 'bevel' },
      });

      expect(edge.style.lineCap).toBe('round');
      expect(edge.style.lineJoin).toBe('bevel');
    });
  });

  describe('label options', () => {
    it('supports label offset', () => {
      const edge = new Edge({
        from: { nodeId: 'a' },
        to: { nodeId: 'b' },
        label: 'Test',
        labelOffset: 20,
      });

      expect(edge.labelOffset).toBe(20);
    });

    it('supports label background configuration', () => {
      const edge = new Edge({
        from: { nodeId: 'a' },
        to: { nodeId: 'b' },
        label: 'Test',
        labelBackground: { color: '#f0f0f0', borderRadius: 4 },
      });

      expect(edge.labelBackground).toEqual({ color: '#f0f0f0', borderRadius: 4 });
    });

    it('can update label properties after creation', () => {
      const edge = new Edge({
        from: { nodeId: 'a' },
        to: { nodeId: 'b' },
        label: 'Test',
      });

      edge.labelOffset = 15;
      edge.labelBackground = { color: 'yellow' };

      expect(edge.labelOffset).toBe(15);
      expect(edge.labelBackground?.color).toBe('yellow');
    });
  });
});
