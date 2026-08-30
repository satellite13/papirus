import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiagramRenderer } from '../DiagramRenderer';
import { stubCanvasContext } from '../../test/testUtils';
import { GridOverlay } from './GridOverlay';

type OverlayRenderer = (ctx: CanvasRenderingContext2D) => void;

function createRenderer(): {
  renderer: DiagramRenderer;
  getCallback: () => OverlayRenderer;
  remove: ReturnType<typeof vi.fn>;
} {
  let callback: OverlayRenderer | undefined;
  const remove = vi.fn();
  const renderer = {
    width: 100,
    height: 60,
    zoom: 1,
    offsetX: -10,
    offsetY: -10,
    pixelRatio: 1,
    addUnderlayRenderer: vi.fn((next: OverlayRenderer) => {
      callback = next;
      return remove;
    }),
  } as unknown as DiagramRenderer;

  return {
    renderer,
    getCallback: () => callback!,
    remove,
  };
}

function worldLineXs(ctx: CanvasRenderingContext2D): number[] {
  const moveTo = vi.mocked(ctx.moveTo).mock.calls;
  const lineTo = vi.mocked(ctx.lineTo).mock.calls;
  const xs: number[] = [];
  for (let i = 0; i < moveTo.length; i++) {
    const from = moveTo[i];
    const to = lineTo[i];
    if (from === undefined || to === undefined) {
      continue;
    }
    if (from[0] === to[0]) {
      xs.push(from[0]);
    }
  }
  return xs;
}

function isWorldMultiple(value: number, gridSize: number): boolean {
  const n = value / gridSize;
  return Math.abs(n - Math.round(n)) < 1e-9;
}

describe('GridOverlay', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    stubCanvasContext();
  });

  it('installs an underlay that strokes world-aligned grid lines', () => {
    const { renderer, getCallback, remove } = createRenderer();
    const overlay = new GridOverlay({ gridSize: 20, color: '#123456' });
    const ctx = document.createElement('canvas').getContext('2d')!;

    overlay.install(renderer);
    getCallback()(ctx);

    expect((renderer.addUnderlayRenderer as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
    expect(ctx.strokeStyle).toBe('#123456');
    expect(ctx.stroke).toHaveBeenCalled();
    expect(worldLineXs(ctx).every((x) => isWorldMultiple(x, 20))).toBe(true);

    overlay.destroy();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('skips rendering while disabled and resumes with updated grid settings', () => {
    const { renderer, getCallback } = createRenderer();
    const overlay = new GridOverlay();
    const ctx = document.createElement('canvas').getContext('2d')!;

    overlay.install(renderer);
    overlay.setEnabled(false);
    getCallback()(ctx);
    expect(ctx.beginPath).not.toHaveBeenCalled();

    overlay.setGridSize(50);
    overlay.setColor('#abcdef');
    overlay.setEnabled(true);
    getCallback()(ctx);

    expect(ctx.strokeStyle).toBe('#abcdef');
    expect(ctx.stroke).toHaveBeenCalled();
    expect(worldLineXs(ctx).every((x) => isWorldMultiple(x, 25))).toBe(true);
  });

  it('coarsens the world step when zoom would turn cells into mush', () => {
    const { renderer, getCallback } = createRenderer();
    renderer.zoom = 0.1;
    renderer.width = 400;
    renderer.height = 400;
    const overlay = new GridOverlay({ gridSize: 20 });
    const ctx = document.createElement('canvas').getContext('2d')!;

    overlay.install(renderer);
    getCallback()(ctx);

    const xs = [...new Set(worldLineXs(ctx))].sort((a, b) => a - b);
    expect(xs.length).toBeGreaterThan(1);
    expect(xs[1]! - xs[0]!).toBe(160);
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('subdivides the world step when zoom would make huge empty cells', () => {
    const { renderer, getCallback } = createRenderer();
    renderer.zoom = 4;
    const overlay = new GridOverlay({ gridSize: 20 });
    const ctx = document.createElement('canvas').getContext('2d')!;

    overlay.install(renderer);
    getCallback()(ctx);

    const xs = [...new Set(worldLineXs(ctx))].sort((a, b) => a - b);
    expect(xs.length).toBeGreaterThan(2);
    expect(xs[1]! - xs[0]!).toBe(5);
  });

  it('keeps lines on world grid multiples when zoom is not an integer', () => {
    const { renderer, getCallback } = createRenderer();
    renderer.zoom = 1.37;
    renderer.offsetX = 11;
    renderer.offsetY = 7;
    const overlay = new GridOverlay({ gridSize: 20 });
    const ctx = document.createElement('canvas').getContext('2d')!;

    overlay.install(renderer);
    getCallback()(ctx);

    const xs = worldLineXs(ctx);
    expect(xs.length).toBeGreaterThan(2);
    expect(xs.every((x) => isWorldMultiple(x, 20))).toBe(true);
    expect(ctx.fillRect).not.toHaveBeenCalled();
    expect(ctx.lineWidth).toBeCloseTo(1 / 1.37);
  });

  it('does not snap the cell to whole screen pixels across zoom steps', () => {
    const { renderer, getCallback } = createRenderer();
    const overlay = new GridOverlay({ gridSize: 20 });
    const ctx = document.createElement('canvas').getContext('2d')!;

    overlay.install(renderer);
    renderer.zoom = 1.13;
    getCallback()(ctx);
    const first = worldLineXs(ctx);
    expect(first.every((x) => isWorldMultiple(x, 20))).toBe(true);

    vi.mocked(ctx.moveTo).mockClear();
    vi.mocked(ctx.lineTo).mockClear();
    renderer.zoom = 1.19;
    getCallback()(ctx);
    const second = worldLineXs(ctx);
    expect(second.length).toBeGreaterThan(2);
    expect(second.every((x) => isWorldMultiple(x, 20))).toBe(true);
  });
});
