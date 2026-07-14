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

describe('GridOverlay', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    stubCanvasContext();
  });

  it('installs an underlay that renders grid lines for the visible world area', () => {
    const { renderer, getCallback, remove } = createRenderer();
    const overlay = new GridOverlay({ gridSize: 20, color: '#123456' });
    const ctx = document.createElement('canvas').getContext('2d')!;

    overlay.install(renderer);
    getCallback()(ctx);

    expect((renderer.addUnderlayRenderer as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
    expect(ctx.strokeStyle).toBe('#123456');
    expect(ctx.lineWidth).toBe(1);
    expect(ctx.moveTo).toHaveBeenCalledWith(0, 0);
    expect(ctx.lineTo).toHaveBeenCalledWith(0, 80);
    expect(ctx.moveTo).toHaveBeenCalledWith(0, 60);
    expect(ctx.lineTo).toHaveBeenCalledWith(120, 60);
    expect(ctx.stroke).toHaveBeenCalledTimes(1);

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
    expect(ctx.moveTo).toHaveBeenCalledWith(50, 0);
  });
});
