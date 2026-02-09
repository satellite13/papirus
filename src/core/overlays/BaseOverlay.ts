import type { DiagramPlugin } from '../DiagramRenderer';

/**
 * Base options for all overlays
 */
export interface BaseOverlayOptions {
  enabled?: boolean;
}

/**
 * Abstract base class for diagram overlays
 * Provides common destroy() and setEnabled() functionality
 */
export abstract class BaseOverlay implements DiagramPlugin {
  protected removeOverlay: (() => void) | null = null;
  protected enabled: boolean;

  protected constructor(enabled = true) {
    this.enabled = enabled;
  }

  abstract install(renderer: Parameters<DiagramPlugin['install']>[0]): void;

  destroy(): void {
    this.removeOverlay?.();
    this.removeOverlay = null;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
}
