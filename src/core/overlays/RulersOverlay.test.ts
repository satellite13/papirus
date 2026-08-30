import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiagramRenderer } from '../DiagramRenderer';
import { stubCanvasContext } from '../../test/testUtils';
import { RulersOverlay } from './RulersOverlay';

type OverlayRenderer = (ctx: CanvasRenderingContext2D) => void;

function createRenderer(): {
  renderer: DiagramRenderer;
  getCallback: () => OverlayRenderer;
  remove: ReturnType<typeof vi.fn>;
} {
  let callback: OverlayRenderer | undefined;
  const remove = vi.fn();
  const renderer = {
    width: 200,
    height: 120,
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    pixelRatio: 2,
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

function renderHorizontalLabels(zoom: number): string[] {
  const { renderer, getCallback } = createRenderer();
  const overlay = new RulersOverlay();
  const ctx = document.createElement('canvas').getContext('2d')!;
  renderer.zoom = zoom;
  overlay.install(renderer);
  vi.mocked(ctx.fillText).mockClear();

  getCallback()(ctx);

  return vi
    .mocked(ctx.fillText)
    .mock.calls.filter(([, , y]) => y === 2)
    .map(([label]) => String(label));
}

describe('RulersOverlay', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    stubCanvasContext();
  });

  it('installs an overlay and renders adaptive ticks with horizontal and vertical labels', () => {
    const { renderer, getCallback, remove } = createRenderer();
    const overlay = new RulersOverlay({
      thickness: 24,
      backgroundColor: '#111111',
      textColor: '#222222',
      tickColor: '#333333',
    });
    const ctx = document.createElement('canvas').getContext('2d')!;

    overlay.install(renderer);
    getCallback()(ctx);

    expect((renderer.addOverlayRenderer as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
    expect(ctx.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 200, 24);
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 24, 120);
    expect(ctx.strokeStyle).toBe('#333333');
    expect(ctx.fillStyle).toBe('#222222');
    expect(ctx.fillText).toHaveBeenCalledWith('100', expect.any(Number), 2);
    expect(ctx.rotate).toHaveBeenCalledWith(-Math.PI / 2);
    expect(ctx.drawImage).toHaveBeenCalled();
    expect(overlay.getTickBakeGeneration()).toBe(1);

    overlay.destroy();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('does not draw when disabled', () => {
    const { renderer, getCallback } = createRenderer();
    const overlay = new RulersOverlay();
    const ctx = document.createElement('canvas').getContext('2d')!;

    overlay.install(renderer);
    overlay.setEnabled(false);
    getCallback()(ctx);

    expect(ctx.save).not.toHaveBeenCalled();
  });

  it('adapts tick labels to the zoom level while preserving screen spacing', () => {
    const labelsAtZoomOne = renderHorizontalLabels(1);
    const labelsAtZoomTwo = renderHorizontalLabels(2);

    expect(labelsAtZoomOne).toEqual(expect.arrayContaining(['0', '100', '200']));
    expect(labelsAtZoomTwo).toEqual(expect.arrayContaining(['0', '50', '100']));
  });

  it('does not rebuild tick labels on pan while zoom stays the same', () => {
    const { renderer, getCallback } = createRenderer();
    const overlay = new RulersOverlay();
    const ctx = document.createElement('canvas').getContext('2d')!;

    overlay.install(renderer);
    getCallback()(ctx);
    expect(overlay.getTickBakeGeneration()).toBe(1);

    renderer.offsetX = 24;
    renderer.offsetY = 16;
    vi.mocked(ctx.fillText).mockClear();
    getCallback()(ctx);

    expect(overlay.getTickBakeGeneration()).toBe(1);
    expect(ctx.fillText).not.toHaveBeenCalled();

    renderer.zoom = 2;
    getCallback()(ctx);
    expect(overlay.getTickBakeGeneration()).toBe(2);
  });
});
