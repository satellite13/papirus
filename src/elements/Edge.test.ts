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

  it('recalculates path immediately when type changes from bezier to straight', () => {
    const edge = new Edge({
      from: { nodeId: 'a' },
      to: { nodeId: 'b' },
      type: 'bezier',
    });

    edge.updateEndpoints({ x: 0, y: 0 }, { x: 100, y: 40 }, 'right', 'left');
    expect(edge.path.length).toBe(4);

    edge.type = 'straight';

    expect(edge.type).toBe('straight');
    expect(edge.path).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 40 },
    ]);
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

    // No self-loop bypass: standard directed path (duplicates collapsed).
    expect(edge.path.length).toBeGreaterThanOrEqual(3);
    expect(edge.path.length).toBeLessThan(6);
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

  it('does not leave an outward tail past the first turn', () => {
    const from = { x: 340, y: 280 }
    const to = { x: 280, y: 90 }
    const edge = new Edge({
      from: { nodeId: 'dp', portId: 'anchor:right:0' },
      to: { nodeId: 'bp', portId: 'anchor:bottom:0' },
      type: 'polyline',
    })
    edge.updateEndpoints(from, to, 'right', 'bottom')

    const path = edge.path
    expect(path[0]).toEqual(from)
    // Exit goes right, then the next distinct corner must not step back left
    // (that overhang is the visible "tail" past the vertical).
    let maxX = from.x
    for (let i = 1; i < path.length; i++) {
      const p = path[i]!
      if (p.x > maxX) maxX = p.x
    }
    const exitIdx = path.findIndex((p) => Math.abs(p.x - maxX) < 0.5)
    expect(exitIdx).toBeGreaterThan(0)
    // After reaching max outward X, subsequent points on the start row should not
    // appear — the turn happens at the outermost exit.
    for (let i = exitIdx + 1; i < path.length; i++) {
      const p = path[i]!
      if (Math.abs(p.y - from.y) < 0.5) {
        expect(p.x).toBeGreaterThanOrEqual(maxX - 0.5)
      }
    }
    // Clean L at start: second point outward, third leaves the start row.
    expect(path[1]!.x).toBeGreaterThan(from.x)
    expect(Math.abs(path[2]!.y - from.y)).toBeGreaterThan(0.5)
  })

  it('enforces perpendicular exit and arrival for polyline terminals', () => {
    const cases: Array<{
      name: string
      from: { x: number; y: number }
      to: { x: number; y: number }
      fromDir: string
      toDir: string
    }> = [
      {
        name: 'right→bottom',
        from: { x: 200, y: 300 },
        to: { x: 280, y: 80 },
        fromDir: 'right',
        toDir: 'bottom',
      },
      {
        name: 'top→bottom',
        from: { x: 520, y: 150 },
        to: { x: 400, y: 90 },
        fromDir: 'top',
        toDir: 'bottom',
      },
      {
        name: 'left→bottom',
        from: { x: 200, y: 260 },
        to: { x: 280, y: 80 },
        fromDir: 'left',
        toDir: 'bottom',
      },
    ]

    for (const c of cases) {
      const edge = new Edge({
        from: { nodeId: 'a' },
        to: { nodeId: 'b' },
        type: 'polyline',
      })
      edge.updateEndpoints(c.from, c.to, c.fromDir, c.toDir, {
        obstacles: [{ id: 'parent', x: 160, y: 140, width: 200, height: 140 }],
      })
      const path = edge.path
      expect(path[0], c.name).toEqual(c.from)
      expect(path[path.length - 1], c.name).toEqual(c.to)

      const p1 = path[1]!
      if (c.fromDir === 'left') expect(p1.x, c.name).toBeLessThan(c.from.x)
      if (c.fromDir === 'right') expect(p1.x, c.name).toBeGreaterThan(c.from.x)
      if (c.fromDir === 'top') expect(p1.y, c.name).toBeLessThan(c.from.y)
      if (c.fromDir === 'bottom') expect(p1.y, c.name).toBeGreaterThan(c.from.y)

      const pre = path[path.length - 2]!
      if (c.toDir === 'bottom' || c.toDir === 'top') {
        expect(Math.abs(pre.x - c.to.x), c.name).toBeLessThan(0.5)
        expect(Math.abs(pre.y - c.to.y), c.name).toBeGreaterThan(1)
      } else {
        expect(Math.abs(pre.y - c.to.y), c.name).toBeLessThan(0.5)
        expect(Math.abs(pre.x - c.to.x), c.name).toBeGreaterThan(1)
      }
    }
  })

  it('keeps fixed endpoints and arrives vertically into bottom target', () => {
    const from = { x: 208, y: 216 };
    const to = { x: 224, y: 72 };
    const edge = new Edge({
      from: { nodeId: 'dp', portId: 'anchor:right:0' },
      to: { nodeId: 'bp', portId: 'anchor:bottom:0' },
      type: 'polyline',
    });

    edge.updateEndpoints(from, to, 'right', 'bottom', {
      obstacles: [{ x: 40, y: 90, width: 180, height: 80 }],
    });

    const path = edge.path;
    expect(path[0]).toEqual(from);
    expect(path[path.length - 1]).toEqual(to);
    const pre = path[path.length - 2]!;
    // Final approach must be vertical (same X), not crawl along the target edge.
    expect(Math.abs(pre.x - to.x)).toBeLessThan(0.5);
    expect(Math.abs(pre.y - to.y)).toBeGreaterThan(1);
  });

  it('does not crawl along target edge when toDir is omitted', () => {
    const from = { x: 208, y: 216 };
    const to = { x: 224, y: 72 };
    const edge = new Edge({
      from: { nodeId: 'dp', portId: 'anchor:right:0' },
      to: { nodeId: 'bp' },
      type: 'polyline',
    });

    edge.updateEndpoints(from, to, 'right', undefined, {
      obstacles: [{ x: 40, y: 90, width: 180, height: 80 }],
    });

    const path = edge.path;
    expect(path[0]).toEqual(from);
    expect(path[path.length - 1]).toEqual(to);
    const pre = path[path.length - 2]!;
    expect(Math.abs(pre.x - to.x)).toBeLessThan(0.5);
    expect(Math.abs(pre.y - to.y)).toBeGreaterThan(1);
  });

  it('exits outward for left→bottom instead of cutting through the node', () => {
    const from = { x: 200, y: 260 }; // left side of component
    const to = { x: 280, y: 80 }; // bottom of BP (to the right of from)
    const edge = new Edge({
      from: { nodeId: 'comp', portId: 'anchor:left:0' },
      to: { nodeId: 'bp', portId: 'anchor:bottom:0' },
      type: 'polyline',
    });

    edge.updateEndpoints(from, to, 'left', 'bottom');

    const path = edge.path;
    expect(path[0]).toEqual(from);
    expect(path[path.length - 1]).toEqual(to);
    // First bend must go further left (outward), not into the component toward to.x
    expect(path[1]!.x).toBeLessThan(from.x);
    const pre = path[path.length - 2]!;
    expect(Math.abs(pre.x - to.x)).toBeLessThan(0.5);
  });

  it('exits clear of parent container before turning toward target', () => {
    const from = { x: 200, y: 260 }
    const to = { x: 260, y: 90 }
    const parent = { id: 'parent', x: 160, y: 200, width: 220, height: 160 }
    const edge = new Edge({
      from: { nodeId: 'comp', portId: 'anchor:left:0' },
      to: { nodeId: 'bp', portId: 'anchor:bottom:0' },
      type: 'polyline',
    })
    edge.updateEndpoints(from, to, 'left', 'bottom', { obstacles: [parent] })

    const path = edge.path
    expect(path[0]).toEqual(from)
    expect(path[path.length - 1]).toEqual(to)
    // First exit clears parent left edge (with margin)
    expect(path[1]!.x).toBeLessThan(parent.x - 8)

    const inset = {
      x: parent.x + 4,
      y: parent.y + 4,
      width: parent.width - 8,
      height: parent.height - 8,
    }
    for (let i = 2; i < path.length; i++) {
      const a = path[i - 1]!
      const b = path[i]!
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const inside =
        mid.x > inset.x &&
        mid.x < inset.x + inset.width &&
        mid.y > inset.y &&
        mid.y < inset.y + inset.height
      expect(inside).toBe(false)
    }
  })

  it('routes around a parent container obstacle without crossing it', () => {
    // Nested component inside parent; edge from component left to BP above.
    // Parent must remain an obstacle (not filtered just because start is inside it).
    const from = { x: 180, y: 260 };
    const to = { x: 260, y: 80 };
    const parent = { id: 'parent', x: 160, y: 200, width: 220, height: 160 };
    const edge = new Edge({
      from: { nodeId: 'comp', portId: 'anchor:left:0' },
      to: { nodeId: 'bp', portId: 'anchor:bottom:0' },
      type: 'polyline',
    });

    // After EdgeEndpointUpdater filters out endpoint nodes by id, parent remains.
    edge.updateEndpoints(from, to, 'left', 'bottom', {
      obstacles: [parent],
    });

    const path = edge.path;
    expect(path[0]).toEqual(from);
    expect(path[path.length - 1]).toEqual(to);

    // No segment should cut through the parent interior (strictly inside, not on border).
    const inset = {
      x: parent.x + 4,
      y: parent.y + 4,
      width: parent.width - 8,
      height: parent.height - 8,
    };
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1]!;
      const b = path[i]!;
      // Sample midpoint of each segment
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const inside =
        mid.x > inset.x &&
        mid.x < inset.x + inset.width &&
        mid.y > inset.y &&
        mid.y < inset.y + inset.height;
      // Start may lie on the parent border; later midpoints must not pierce interior.
      if (i > 1) {
        expect(inside).toBe(false);
      }
    }
  });

  it('arrives vertically into bottom target even when end is far sideways', () => {
    // Component close under a wide Business Process; end X far from start X.
    // |dx| > |dy| must NOT flip approach to left/right (crawl along BP edge).
    const from = { x: 520, y: 150 };
    const to = { x: 400, y: 90 };
    const edge = new Edge({
      from: { nodeId: 'comp', portId: 'anchor:top:0' },
      to: { nodeId: 'bp', portId: 'anchor:bottom:0' },
      type: 'polyline',
    });

    edge.updateEndpoints(from, to, 'top', 'bottom', {
      obstacles: [{ id: 'parent', x: 400, y: 150, width: 200, height: 120 }],
    });

    const path = edge.path;
    expect(path[0]).toEqual(from);
    expect(path[path.length - 1]).toEqual(to);
    const pre = path[path.length - 2]!;
    expect(Math.abs(pre.x - to.x)).toBeLessThan(0.5);
    expect(Math.abs(pre.y - to.y)).toBeGreaterThan(1);
    // No horizontal segment on the target edge itself.
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1]!;
      const b = path[i]!;
      const onEdge = Math.abs(a.y - to.y) < 0.5 && Math.abs(b.y - to.y) < 0.5;
      const horizontal = Math.abs(a.y - b.y) < 0.5 && Math.abs(a.x - b.x) > 1;
      expect(onEdge && horizontal).toBe(false);
    }
  });

  it('arrives vertically when vertical gap is smaller than MIN_SEGMENT_LENGTH', () => {
    // Tight gap under a wide BP: |dy| < 20 used to flip approach to left/right
    // and crawl the bottom edge — last segment must stay vertical.
    const from = { x: 520, y: 102 };
    const to = { x: 400, y: 90 };
    const edge = new Edge({
      from: { nodeId: 'comp', portId: 'anchor:left:0' },
      to: { nodeId: 'bp', portId: 'anchor:bottom:0' },
      type: 'polyline',
    });

    edge.updateEndpoints(from, to, 'left', 'bottom', {
      obstacles: [{ id: 'parent', x: 450, y: 100, width: 180, height: 100 }],
    });

    const path = edge.path;
    expect(path[0]).toEqual(from);
    expect(path[path.length - 1]).toEqual(to);
    const pre = path[path.length - 2]!;
    expect(Math.abs(pre.x - to.x)).toBeLessThan(0.5);
    expect(Math.abs(pre.y - to.y)).toBeGreaterThan(1);
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1]!;
      const b = path[i]!;
      const onEdge = Math.abs(a.y - to.y) < 0.5 && Math.abs(b.y - to.y) < 0.5;
      const horizontal = Math.abs(a.y - b.y) < 0.5 && Math.abs(a.x - b.x) > 1;
      expect(onEdge && horizontal).toBe(false);
    }
  });

  it('ignores conflicting horizontal toDir when target is clearly above', () => {
    // Endpoints fixed on right→bottom geometry, but toDir wrongly says "left"
    // (wide Business Process / corner outline). Must not crawl along y=to.y.
    const from = { x: 260, y: 450 };
    const to = { x: 300, y: 98 };
    const edge = new Edge({
      from: { nodeId: 'dp', portId: 'anchor:right:0' },
      to: { nodeId: 'bp', portId: 'anchor:left:0' },
      type: 'polyline',
    });

    edge.updateEndpoints(from, to, 'right', 'left', {
      obstacles: [
        { x: 32, y: 32, width: 536, height: 66 },
        { x: 72, y: 400, width: 188, height: 108 },
      ],
    });

    const path = edge.path;
    expect(path[0]).toEqual(from);
    expect(path[path.length - 1]).toEqual(to);
    const pre = path[path.length - 2]!;
    expect(Math.abs(pre.x - to.x)).toBeLessThan(0.5);
    expect(Math.abs(pre.y - to.y)).toBeGreaterThan(1);
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

  describe('updateEndpoints', () => {
    it('skips path rebuild when endpoints are unchanged', () => {
      const edge = new Edge({
        from: { nodeId: 'a' },
        to: { nodeId: 'b' },
        type: 'straight',
      });
      edge.updateEndpoints({ x: 0, y: 0 }, { x: 100, y: 0 }, 'right', 'left');
      const pathAfterFirst = edge.path;
      edge.updateEndpoints({ x: 0, y: 0 }, { x: 100, y: 0 }, 'right', 'left');
      expect(edge.path).toBe(pathAfterFirst);
    });

    it('rebuilds path when obstacles appear with same endpoints (reconnect → updateAll)', () => {
      const edge = new Edge({
        from: { nodeId: 'check' },
        to: { nodeId: 'error' },
        type: 'polyline',
      });
      const from = { x: 570, y: 180 };
      const to = { x: 640, y: 310 };
      // Reconnect preview without obstacles can leave a path through the target body.
      edge.updateEndpoints(from, to, 'bottom', 'right');
      const pathWithoutObstacles = edge.path;
      const snapshot = pathWithoutObstacles.map((p) => ({ ...p }));

      const target = { id: 'error', x: 520, y: 280, width: 120, height: 60, role: 'target' as const };
      edge.updateEndpoints(from, to, 'bottom', 'right', { obstacles: [target] });

      // Must rebuild (not early-return) when only routing options change.
      expect(edge.path).not.toBe(pathWithoutObstacles);
      expect(edge.path).not.toEqual(snapshot);
      const pre = edge.path[edge.path.length - 2]!;
      // Arrive from outside along the attachment side (right).
      expect(pre.x).toBeGreaterThan(to.x - 0.5);
      expect(pre.y).toBeCloseTo(to.y, 5);
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
      const types = ['none', 'arrow', 'open', 'diamond', 'circle', 'square', 'stealth'] as const;

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
