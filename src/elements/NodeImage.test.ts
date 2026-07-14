import { describe, expect, it, vi } from 'vitest';
import { NodeImage } from './NodeImage';

const { resolveTintedSvgDataUrl, resolveTintedSvgDataUrlSync } = vi.hoisted(() => ({
  resolveTintedSvgDataUrl: vi.fn(),
  resolveTintedSvgDataUrlSync: vi.fn(),
}));

vi.mock('@/utils/svgAssetLoader', () => ({
  fetchSvgText: vi.fn(),
  resolveTintedSvgDataUrl,
  resolveTintedSvgDataUrlSync,
}));

class FakeImage {
  src = '';
  complete = false;
  naturalWidth = 0;
  naturalHeight = 0;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  decoding = '';
}

describe('NodeImage', () => {
  it('uses the synchronous shared SVG loader for tinted inline SVG sources', () => {
    vi.stubGlobal('Image', FakeImage);
    resolveTintedSvgDataUrlSync.mockReturnValue('data:image/svg+xml,shared');
    const image = new NodeImage({
      source: '<svg xmlns="http://www.w3.org/2000/svg"><path fill="#000"/></svg>',
      fillColor: '#ff0000',
    });

    expect(resolveTintedSvgDataUrlSync).toHaveBeenCalledWith(
      '<svg xmlns="http://www.w3.org/2000/svg"><path fill="#000"/></svg>',
      { strokeColor: undefined, fillColor: '#ff0000' }
    );
    expect((image as unknown as { _image: FakeImage })._image.src).toBe(
      'data:image/svg+xml,shared'
    );
  });
});
