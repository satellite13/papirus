/**
 * Temporary routing diagnostics for wArchi / papirus debugging.
 *
 * Enable in browser console:
 *   localStorage.setItem('papirusRouteDebug', '1')
 *   location.reload()
 *
 * Disable:
 *   localStorage.removeItem('papirusRouteDebug')
 */

export type RouteDebugPayload = Record<string, unknown>;

export function isRouteDebugEnabled(): boolean {
  if (typeof globalThis === 'undefined') return false;
  const g = globalThis as { __PAPIRUS_ROUTE_DEBUG__?: unknown };
  if (g.__PAPIRUS_ROUTE_DEBUG__ === true || g.__PAPIRUS_ROUTE_DEBUG__ === 1) return true;
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('papirusRouteDebug') === '1') {
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

export function routeDebug(tag: string, payload: RouteDebugPayload): void {
  if (!isRouteDebugEnabled()) return;
  // eslint-disable-next-line no-console -- intentional temporary diagnostics
  console.log(`[papirus:route] ${tag}`, payload);
}
