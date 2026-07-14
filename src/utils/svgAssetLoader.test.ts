import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearSvgTextCache,
  fetchSvgText,
  resolveTintedSvgDataUrl,
} from './svgAssetLoader';

describe('svgAssetLoader', () => {
  beforeEach(() => {
    clearSvgTextCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('caches fetched SVG text by URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue('<svg></svg>'),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchSvgText('/icon.svg')).resolves.toBe('<svg></svg>');
    await expect(fetchSvgText('/icon.svg')).resolves.toBe('<svg></svg>');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns empty text for an unsuccessful fetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    await expect(fetchSvgText('/missing.svg')).resolves.toBe('');
  });

  it('returns empty text when fetching SVG rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Invalid URL')));

    await expect(fetchSvgText('/icon.svg')).resolves.toBe('');
  });

  it('clears the shared fetch cache', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue('<svg></svg>'),
    });
    vi.stubGlobal('fetch', fetchMock);

    await fetchSvgText('/icon.svg');
    clearSvgTextCache();
    await fetchSvgText('/icon.svg');

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('resolves and tints inline SVG markup', async () => {
    const result = await resolveTintedSvgDataUrl('<svg><path fill="red"/></svg>', {
      fillColor: '#00ff00',
    });

    expect(result).toMatch(/^data:image\/svg\+xml;utf8,/);
    expect(decodeURIComponent(result!)).toContain('fill="#00ff00"');
  });

  it('returns null for non-SVG sources', async () => {
    await expect(resolveTintedSvgDataUrl('/photo.png')).resolves.toBeNull();
  });
});
