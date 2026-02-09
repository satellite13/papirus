import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RectangleNode } from './nodes/RectangleNode';
import { mockCanvasContext } from '../test/testUtils';

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 40;
  naturalHeight = 20;
  complete = false;
  decoding = 'async';

  set src(_value: string) {
    this.complete = true;
    this.naturalWidth = 40;
    this.naturalHeight = 20;
    this.onload?.();
  }
}

describe('Node', () => {
  const originalImage = globalThis.Image;

  beforeEach(() => {
    globalThis.Image = FakeImage as unknown as typeof Image;
  });

  afterEach(() => {
    globalThis.Image = originalImage;
  });

  it('renders label and icon when provided', () => {
    const ctx = mockCanvasContext();
    const node = new RectangleNode({
      x: 0,
      y: 0,
      width: 120,
      height: 80,
      label: 'Node',
      icon: {
        source: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>',
        placement: 'top',
      },
    });

    node.render(ctx);

    expect(ctx.drawImage).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalled();
  });
});
