import type { Point } from '@/types';

export interface LabelEditorState {
  kind: 'node' | 'edge';
  id: string;
  textarea: HTMLTextAreaElement;
  cleanup: () => void;
}

export type LabelCommitCallback = (kind: 'node' | 'edge', id: string, value: string) => void;

/**
 * Manages inline label editing for nodes and edges
 */
export class LabelEditor {
  private state: LabelEditorState | null = null;

  /**
   * Check if editor is currently active
   */
  get isActive(): boolean {
    return this.state !== null;
  }

  /**
   * Get current editor state
   */
  get currentState(): Readonly<LabelEditorState> | null {
    return this.state;
  }

  /**
   * Start editing a label
   */
  start(
    kind: 'node' | 'edge',
    id: string,
    text: string,
    worldPosition: Point,
    worldToScreen: (x: number, y: number) => Point,
    onCommit: LabelCommitCallback
  ): void {
    this.finish(true);

    const screenPoint = worldToScreen(worldPosition.x, worldPosition.y);
    const textarea = this.createTextarea(text, screenPoint);
    const { cleanup } = this.setupEventHandlers(textarea, onCommit);

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    this.state = { kind, id, textarea, cleanup };
  }

  /**
   * Finish editing
   * @param commit - Whether to commit the changes
   * @param onCommit - Callback to invoke if committing
   */
  finish(commit: boolean, onCommit?: LabelCommitCallback): void {
    if (!this.state) {
      return;
    }

    const { kind, id, textarea, cleanup } = this.state;
    this.state = null;
    const value = textarea.value;
    cleanup();

    if (commit && onCommit) {
      onCommit(kind, id, value);
    }
  }

  private createTextarea(text: string, screenPoint: Point): HTMLTextAreaElement {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.rows = 1;
    textarea.spellcheck = false;
    textarea.setAttribute('aria-label', 'Edit label');

    // Position and styling
    textarea.style.cssText = `
      position: fixed;
      left: ${screenPoint.x}px;
      top: ${screenPoint.y}px;
      transform: translate(-50%, -50%);
      z-index: 10001;
      min-width: 120px;
      max-width: 420px;
      min-height: 30px;
      padding: 6px 8px;
      border: 1px solid #6366f1;
      border-radius: 6px;
      box-shadow: 0 8px 18px rgba(15, 23, 42, 0.15);
      background: #ffffff;
      color: #0f172a;
      font: 14px sans-serif;
      line-height: 1.4;
      resize: none;
      overflow: hidden;
    `;

    this.resizeTextarea(textarea);

    return textarea;
  }

  private resizeTextarea(textarea: HTMLTextAreaElement): void {
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.max(30, textarea.scrollHeight)}px`;
  }

  private setupEventHandlers(
    textarea: HTMLTextAreaElement,
    onCommit: LabelCommitCallback
  ): { cleanup: () => void; commit: () => void } {
    const commit = (): void => this.finish(true, onCommit);
    const cancel = (): void => this.finish(false);

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        commit();
      }
    };

    const handleBlur = (): void => commit();
    const handleInput = (): void => this.resizeTextarea(textarea);

    textarea.addEventListener('keydown', handleKeyDown);
    textarea.addEventListener('blur', handleBlur);
    textarea.addEventListener('input', handleInput);

    const cleanup = (): void => {
      textarea.removeEventListener('keydown', handleKeyDown);
      textarea.removeEventListener('blur', handleBlur);
      textarea.removeEventListener('input', handleInput);
      textarea.remove();
    };

    return { cleanup, commit };
  }
}
