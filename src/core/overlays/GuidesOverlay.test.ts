import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiagramRenderer } from '../DiagramRenderer';
import { stubCanvasContext } from '../../test/testUtils';
import { GuidesOverlay } from './GuidesOverlay';

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
    height: 80,
    zoom: 2,
    offsetX: -20,
    offsetY: -40,
    addOverlayRenderer: vi.fn((next: OverlayRenderer) => {
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

describe('GuidesOverlay', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    stubCanvasContext();
  });

  it('renders only guides inside the visible world bounds', () => {
    const { renderer, getCallback, remove } = createRenderer();
    const overlay = new GuidesOverlay({
      vertical: [10, 30, 70],
      horizontal: [10, 40, 70],
      color: '#123456',
      lineWidth: 4,
    });
    const ctx = document.createElement('canvas').getContext('2d')!;

    overlay.install(renderer);
    getCallback()(ctx);

    expect((renderer.addOverlayRenderer as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
    expect(ctx.strokeStyle).toBe('#123456');
    expect(ctx.lineWidth).toBe(2);
    expect(ctx.moveTo).toHaveBeenCalledWith(30, 20);
    expect(ctx.lineTo).toHaveBeenCalledWith(30, 60);
    expect(ctx.moveTo).toHaveBeenCalledWith(10, 40);
    expect(ctx.lineTo).toHaveBeenCalledWith(60, 40);
    expect(ctx.moveTo).not.toHaveBeenCalledWith(70, 20);
    expect(ctx.moveTo).not.toHaveBeenCalledWith(10, 70);
    expect(ctx.stroke).toHaveBeenCalledTimes(1);

    overlay.destroy();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('uses updated guides after being re-enabled', () => {
    const { renderer, getCallback } = createRenderer();
    const overlay = new GuidesOverlay();
    const ctx = document.createElement('canvas').getContext('2d')!;

    overlay.install(renderer);
    overlay.setEnabled(false);
    getCallback()(ctx);
    expect(ctx.beginPath).not.toHaveBeenCalled();

    overlay.setGuides([40], [50]);
    overlay.setEnabled(true);
    getCallback()(ctx);

    expect(ctx.moveTo).toHaveBeenCalledWith(40, 20);
    expect(ctx.lineTo).toHaveBeenCalledWith(40, 60);
    expect(ctx.moveTo).toHaveBeenCalledWith(10, 50);
    expect(ctx.lineTo).toHaveBeenCalledWith(60, 50);
  });
});
