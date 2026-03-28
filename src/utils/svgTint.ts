/**
 * SVG tinting utilities — shared between NodeImage and CIcon.
 */

function styleSetColor(style: string, key: 'stroke' | 'fill', color: string): string {
  const hasKey = new RegExp(`${key}\\s*:`).test(style);
  if (hasKey) {
    return style.replace(new RegExp(`${key}\\s*:[^;]+`), `${key}:${color}`);
  }
  const suffix = style.trim().endsWith(';') || style.trim() === '' ? '' : ';';
  return `${style}${suffix}${key}:${color};`;
}

/**
 * Tint all stroke/fill attributes and inline styles in an SVG string.
 */
export function tintSvg(
  svgText: string,
  strokeColor?: string,
  fillColor?: string
): string {
  if (!strokeColor && !fillColor) return svgText;

  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  const root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() === 'parsererror') {
    return svgText;
  }

  const all = [root, ...Array.from(root.querySelectorAll('*'))] as Element[];
  for (const el of all) {
    const stroke = el.getAttribute('stroke');
    const fill = el.getAttribute('fill');
    if (strokeColor && (stroke === null || stroke.toLowerCase() !== 'none')) {
      el.setAttribute('stroke', strokeColor);
    }
    if (fillColor && (fill === null || fill.toLowerCase() !== 'none')) {
      el.setAttribute('fill', fillColor);
    }
    const style = el.getAttribute('style');
    if (style) {
      let next = style;
      if (strokeColor && /stroke\s*:\s*(?!none)/.test(style)) {
        next = styleSetColor(next, 'stroke', strokeColor);
      }
      if (fillColor && /fill\s*:\s*(?!none)/.test(style)) {
        next = styleSetColor(next, 'fill', fillColor);
      }
      if (next !== style) {
        el.setAttribute('style', next);
      }
    }
  }

  return new XMLSerializer().serializeToString(root);
}

/**
 * Check if a string contains inline SVG markup.
 */
export function isSvgMarkup(value: string): boolean {
  const trimmed = value.trim().toLowerCase();
  return trimmed.startsWith('<svg') || trimmed.includes('<svg');
}

/**
 * Convert SVG markup to a data URL for use in HTMLImageElement.src.
 */
export function svgToDataUrl(svg: string): string {
  const encoded = encodeURIComponent(svg)
    .replace(/%0A/g, '')
    .replace(/%0D/g, '')
    .replace(/%09/g, ' ')
    .replace(/%20/g, ' ');
  return `data:image/svg+xml;utf8,${encoded}`;
}

/**
 * Check if a URL points to an SVG file.
 */
export function isSvgUrl(url: string): boolean {
  try {
    const path = new URL(url, 'http://localhost').pathname;
    return path.endsWith('.svg');
  } catch {
    return url.endsWith('.svg');
  }
}
