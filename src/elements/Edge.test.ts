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
        labelBackground: { color: '#f0f0f0', padding: 8, borderRadius: 4 },
      });

      expect(edge.labelBackground).toEqual({ color: '#f0f0f0', padding: 8, borderRadius: 4 });
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
