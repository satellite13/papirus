import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ScrollbarController } from './ScrollbarController';
import type { ScrollbarHost } from './ScrollbarController';
import { stubCanvasContext } from '../test/testUtils';

function createHost(overrides: Partial<ScrollbarHost> = {}): ScrollbarHost {
  let offsetX = 0;
  let offsetY = 0;
  return {
    getWidth: () => 200,
    getHeight: () => 100,
    getZoom: () => 1,
    getOffsetX: () => offsetX,
    setOffsetX: (v) => {
      offsetX = v;
    },
    getOffsetY: () => offsetY,
    setOffsetY: (v) => {
      offsetY = v;
    },
    getPixelRatio: () => 1,
    markDirty: vi.fn(),
    screenToCanvas: (x, y) => ({ x, y }),
    getContentBounds: () => null,
    isDarkTheme: () => false,
    ...overrides,
  };
}

describe('ScrollbarController', () => {
  beforeEach(() => {
    stubCanvasContext();
  });

  it('scrollBy returns false when there is no content', () => {
    const host = createHost();
    const controller = new ScrollbarController(host, { width: 200, height: 100 });
    expect(controller.scrollBy(10, 10)).toBe(false);
  });

  it('scrollBy updates offsets within content bounds', () => {
    const host = createHost({
      getContentBounds: () => ({ x: 0, y: 0, width: 500, height: 400 }),
    });
    const controller = new ScrollbarController(host, {
      width: 200,
      height: 100,
      scrollbar: { enabled: true },
    });
    expect(controller.scrollBy(50, 25)).toBe(true);
    expect(host.getOffsetX()).toBe(-50);
    expect(host.getOffsetY()).toBe(-25);
  });

  it('scrollToStart resets offsets to content origin', () => {
    const host = createHost({
      getContentBounds: () => ({ x: 10, y: 20, width: 500, height: 400 }),
    });
    host.setOffsetX(-100);
    host.setOffsetY(-80);
    const controller = new ScrollbarController(host, {
      width: 200,
      height: 100,
      scrollbar: { enabled: true },
    });
    expect(controller.scrollToStart()).toBe(true);
    expect(host.getOffsetX()).toBe(-10);
    expect(host.getOffsetY()).toBe(-20);
  });

  it('hitTestThumb returns null outside thumbs', () => {
    const host = createHost({
      getContentBounds: () => ({ x: 0, y: 0, width: 500, height: 400 }),
    });
    const controller = new ScrollbarController(host, {
      width: 200,
      height: 100,
      scrollbar: { enabled: true },
    });
    expect(controller.hitTestThumb(5, 5)).toBeNull();
  });

  it('updateHover and clearHover mark dirty when axis changes', () => {
    const markDirty = vi.fn();
    const host = createHost({
      getContentBounds: () => ({ x: 0, y: 0, width: 500, height: 400 }),
      markDirty,
    });
    const controller = new ScrollbarController(host, {
      width: 200,
      height: 100,
      scrollbar: { enabled: true },
    });
    controller.clearHover();
    expect(markDirty).not.toHaveBeenCalled();
    controller.updateHover(190, 50);
    controller.clearHover();
  });
});
