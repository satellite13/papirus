export type HistoryShortcut = 'undo' | 'redo';

export interface HistoryShortcutKeys {
  undoKey: string;
  redoKey: string;
}

const DEFAULT_HISTORY_SHORTCUT_KEYS: HistoryShortcutKeys = {
  undoKey: 'z',
  redoKey: 'y',
};

/**
 * Resolves a letter key independently of the active keyboard layout.
 */
export function getShortcutKey(event: KeyboardEvent): string {
  return event.code.startsWith('Key') ? event.code.slice(3).toLowerCase() : event.key.toLowerCase();
}

export function getHistoryShortcut(
  event: KeyboardEvent,
  keys: HistoryShortcutKeys = DEFAULT_HISTORY_SHORTCUT_KEYS
): HistoryShortcut | null {
  if (!event.ctrlKey && !event.metaKey) {
    return null;
  }

  const key = getShortcutKey(event);
  if (key === keys.undoKey.toLowerCase() && !event.shiftKey) {
    return 'undo';
  }
  if (
    key === keys.redoKey.toLowerCase() ||
    (key === keys.undoKey.toLowerCase() && event.shiftKey)
  ) {
    return 'redo';
  }
  return null;
}
