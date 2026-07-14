import { LRUCache } from '@/utils/LRUCache';
import { tintSvg, isSvgMarkup, svgToDataUrl, isSvgUrl } from '@/utils/svgTint';

const DEFAULT_CACHE_SIZE = 100;

/** Shared LRU for fetched SVG text (NodeImage, CIcon, etc.). */
const svgTextCache = new LRUCache<string, Promise<string>>(DEFAULT_CACHE_SIZE);

/**
 * Fetch SVG text with a shared LRU cache.
 */
export function fetchSvgText(url: string): Promise<string> {
  let promise = svgTextCache.get(url);
  if (!promise) {
    promise = fetch(url)
      .then((r) => (r.ok ? r.text() : ''))
      .catch(() => '');
    svgTextCache.set(url, promise);
  }
  return promise;
}

/**
 * Synchronously read SVG from a URL (for SvgExporter). Uses cached promise result when already resolved.
 */
export function readSvgFromUrlSync(url: string): string | null {
  if (typeof XMLHttpRequest === 'undefined') {
    return null;
  }

  try {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    xhr.send();
    if (xhr.status >= 200 && xhr.status < 300) {
      return xhr.responseText || null;
    }
  } catch {
    // Ignore and fallback to raw URL source.
  }

  return null;
}

export interface ResolveSvgHrefOptions {
  strokeColor?: string;
  fillColor?: string;
}

/**
 * Resolve a source string to an href suitable for Image/SVG (async, with tint).
 */
export async function resolveTintedSvgDataUrl(
  source: string,
  options: ResolveSvgHrefOptions = {}
): Promise<string | null> {
  const { strokeColor, fillColor } = options;
  if (isSvgMarkup(source)) {
    return svgToDataUrl(tintSvg(source, strokeColor, fillColor));
  }
  if (isSvgUrl(source) || source.toLowerCase().endsWith('.svg')) {
    const svgText = await fetchSvgText(source);
    if (!svgText) return null;
    return svgToDataUrl(tintSvg(svgText, strokeColor, fillColor));
  }
  return null;
}

/**
 * Resolve a source to a tinted data URL synchronously (SvgExporter path).
 */
export function resolveTintedSvgDataUrlSync(
  source: string,
  options: ResolveSvgHrefOptions = {}
): string | null {
  const { strokeColor, fillColor } = options;
  if (isSvgMarkup(source)) {
    return svgToDataUrl(tintSvg(source, strokeColor, fillColor));
  }
  if (source.toLowerCase().endsWith('.svg')) {
    const svgText = readSvgFromUrlSync(source);
    if (!svgText) return null;
    return svgToDataUrl(tintSvg(svgText, strokeColor, fillColor));
  }
  return null;
}

/** @internal Test helper */
export function clearSvgTextCache(): void {
  svgTextCache.clear();
}
