import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Edge } from '../Edge';
import { mockCanvasContext } from '@/test/testUtils';

describe('EdgeLabelRenderer', () => {
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    ctx = mockCanvasContext() as CanvasRenderingContext2D;
    ctx.measureText = vi.fn(() => ({ width: 20 })) as CanvasRenderingContext2D['measureText'];
  });

  describe('public Edge label API', () => {
    it('places a straight-edge label at its path position and perpendicular offset', () => {
      const edge = new Edge({
        from: { nodeId: 'from' },
        to: { nodeId: 'to' },
        type: 'straight',
        label: 'label',
        labelPosition: 0.25,
        labelOffset: 10,
      });
      edge.updateEndpoints({ x: 0, y: 0 }, { x: 100, y: 0 });

      expect(edge.getLabelPosition()).toEqual({ x: 25, y: 10 });
    });

    it('offsets a bezier-edge label from the curved-path midpoint', () => {
      const edge = new Edge({
        from: { nodeId: 'from' },
        to: { nodeId: 'to' },
        type: 'bezier',
        controlPoints: [
          { x: 0, y: 100 },
          { x: 100, y: 100 },
        ],
        label: 'label',
        labelOffset: 10,
      });
      edge.updateEndpoints({ x: 0, y: 0 }, { x: 100, y: 0 });

      expect(edge.getLabelPosition()).toEqual({ x: 50, y: 85 });
    });

    it('keeps labels upright by flipping a path angle beyond 90 degrees', () => {
      const edge = new Edge({
        from: { nodeId: 'from' },
        to: { nodeId: 'to' },
        type: 'straight',
        label: 'label',
        labelFollowPath: true,
      });
      edge.updateEndpoints({ x: 0, y: 0 }, { x: -10, y: 10 });

      expect(edge.getLabelRotation()).toBeCloseTo(-Math.PI / 4);
    });
  });

  describe('public Edge rendering', () => {
    it('draws the configured rectangular background behind the measured label', () => {
      const fillStyles: string[] = [];
      const alphas: number[] = [];
      let fillStyle = ctx.fillStyle as string;
      let globalAlpha = ctx.globalAlpha;
      Object.defineProperty(ctx, 'fillStyle', {
        configurable: true,
        get: (): string => fillStyle,
        set: (value: string): void => {
          fillStyles.push(value);
          fillStyle = value;
        },
      });
      Object.defineProperty(ctx, 'globalAlpha', {
        configurable: true,
        get: (): number => globalAlpha,
        set: (value: number): void => {
          alphas.push(value);
          globalAlpha = value;
        },
      });

      const edge = new Edge({
        from: { nodeId: 'from' },
        to: { nodeId: 'to' },
        arrowType: 'none',
        label: { text: 'label', style: { fontSize: 10 }, inset: 0 },
        labelBackground: { color: '#123456', opacity: 0.4, borderRadius: 0 },
      });
      edge.updateEndpoints({ x: 0, y: 0 }, { x: 100, y: 0 });
      edge.render(ctx);

      expect(fillStyles).toEqual(['#123456', '#000000']);
      expect(alphas).toEqual([1, 0.4, 1, 1]);
      expect(ctx.fillRect).toHaveBeenCalledWith(40, -6, 20, 12);
      expect(ctx.fillText).toHaveBeenCalledWith('label', 50, 0);
      expect(ctx.globalAlpha).toBe(1);
      expect(ctx.save).toHaveBeenCalledOnce();
      expect(ctx.restore).toHaveBeenCalledOnce();
    });

    it('renders the edge as separate segments around its label when line gap is enabled', () => {
      const edge = new Edge({
        from: { nodeId: 'from' },
        to: { nodeId: 'to' },
        arrowType: 'none',
        label: { text: 'label', style: { fontSize: 10 }, inset: 0 },
        labelLineGap: true,
        labelBackground: { borderRadius: 0 },
      });
      edge.updateEndpoints({ x: 0, y: 0 }, { x: 100, y: 0 });

      edge.render(ctx);

      expect(ctx.moveTo).toHaveBeenCalledWith(0, 0);
      expect(ctx.lineTo).toHaveBeenCalledWith(40, 0);
      expect(ctx.moveTo).toHaveBeenCalledWith(60, 0);
      expect(ctx.lineTo).toHaveBeenCalledWith(100, 0);
    });
  });
});
