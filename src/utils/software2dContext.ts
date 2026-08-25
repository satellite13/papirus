/**
 * Chrome/Blink can drop the GPU backing store of a large accelerated 2D canvas.
 * A software context (`willReadFrequently`) avoids that path. Safari/WebKit
 * does not lose 2D contexts this way, so it stays on the default renderer.
 */
export function shouldPreferSoftware2dContext(
  userAgent: string = typeof navigator === 'undefined' ? '' : navigator.userAgent
): boolean {
  if (/CriOS|FxiOS|EdgiOS/.test(userAgent)) {
    return false;
  }

  return /Chrome\/|Chromium\/|Edg\/|OPR\//.test(userAgent);
}
