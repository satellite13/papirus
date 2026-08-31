import type { AnimationOptions } from '@/types';

export interface AnimationState {
  opacity: number;
  scale: number;
  highlight: number;
}

interface ExitEntry {
  start: number;
  onComplete?: () => void;
}

const DEFAULT_OPTIONS: Required<AnimationOptions> = {
  enabled: false,
  enterDuration: 200,
  exitDuration: 180,
  highlightDuration: 450,
  enterScale: 0.92,
  exitScale: 0.98,
};

export class AnimationManager {
  private options: Required<AnimationOptions>;
  private enter = new Map<string, number>();
  private exit = new Map<string, ExitEntry>();
  private highlight = new Map<string, number>();

  constructor(options: AnimationOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  configure(options: AnimationOptions): void {
    this.options = { ...this.options, ...options };
  }

  get enabled(): boolean {
    return this.options.enabled;
  }

  registerEnter(id: string, now = performance.now()): void {
    if (!this.options.enabled) {
      return;
    }
    this.enter.set(id, now);
  }

  registerExit(id: string, onComplete?: () => void, now = performance.now()): void {
    if (!this.options.enabled) {
      onComplete?.();
      return;
    }
    if (this.exit.has(id)) {
      return;
    }
    this.exit.set(id, { start: now, onComplete });
  }

  registerHighlight(id: string, now = performance.now()): void {
    if (!this.options.enabled) {
      return;
    }
    this.highlight.set(id, now);
  }

  isExiting(id: string): boolean {
    return this.exit.has(id);
  }

  hasActive(): boolean {
    return this.enter.size > 0 || this.exit.size > 0 || this.highlight.size > 0;
  }

  /**
   * Drop all in-flight enter/exit/highlight timers without running exit callbacks.
   * Used by {@link DiagramRenderer.clear} so removed ids do not keep the render loop dirty.
   */
  clear(): void {
    this.enter.clear();
    this.exit.clear();
    this.highlight.clear();
  }

  update(now = performance.now()): boolean {
    if (!this.options.enabled) {
      return false;
    }

    let changed = false;

    for (const [id, start] of this.enter) {
      if (now - start >= this.options.enterDuration) {
        this.enter.delete(id);
        changed = true;
      }
    }

    for (const [id, entry] of this.exit) {
      if (now - entry.start >= this.options.exitDuration) {
        this.exit.delete(id);
        entry.onComplete?.();
        changed = true;
      }
    }

    for (const [id, start] of this.highlight) {
      if (now - start >= this.options.highlightDuration) {
        this.highlight.delete(id);
        changed = true;
      }
    }

    return changed;
  }

  getState(id: string, now = performance.now()): AnimationState {
    const enterStart = this.enter.get(id);
    const exitEntry = this.exit.get(id);
    const highlightStart = this.highlight.get(id);

    let opacity = 1;
    let scale = 1;
    let highlight = 0;

    if (enterStart !== undefined) {
      const progress = Math.min(1, Math.max(0, (now - enterStart) / this.options.enterDuration));
      opacity *= progress;
      scale *= this.lerp(this.options.enterScale, 1, progress);
    }

    if (exitEntry !== undefined) {
      const progress = Math.min(1, Math.max(0, (now - exitEntry.start) / this.options.exitDuration));
      opacity *= 1 - progress;
      scale *= this.lerp(1, this.options.exitScale, progress);
    }

    if (highlightStart !== undefined) {
      const progress = Math.min(1, Math.max(0, (now - highlightStart) / this.options.highlightDuration));
      highlight = 1 - progress;
      scale *= 1 + 0.03 * highlight;
    }

    return { opacity, scale, highlight };
  }

  private lerp(from: number, to: number, t: number): number {
    return from + (to - from) * t;
  }
}
