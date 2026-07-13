import { describe, it, expect, vi } from 'vitest';
import { HistoryManager } from './HistoryManager';
import { getHistoryShortcut } from '../utils/keymap';

describe('HistoryManager', () => {
  it('starts with empty undo/redo', () => {
    const history = new HistoryManager();
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
    expect(history.undoCount).toBe(0);
    expect(history.redoCount).toBe(0);
  });

  it('executes command and enables undo', () => {
    const history = new HistoryManager();
    const execute = vi.fn();
    const undo = vi.fn();

    history.execute({ execute, undo });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(false);
    expect(history.undoCount).toBe(1);
  });

  it('undo reverts command', () => {
    const history = new HistoryManager();
    const execute = vi.fn();
    const undo = vi.fn();

    history.execute({ execute, undo });
    const result = history.undo();

    expect(result).toBe(true);
    expect(undo).toHaveBeenCalledTimes(1);
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(true);
    expect(history.redoCount).toBe(1);
  });

  it('redo re-executes undone command', () => {
    const history = new HistoryManager();
    const execute = vi.fn();
    const undo = vi.fn();

    history.execute({ execute, undo });
    history.undo();
    const result = history.redo();

    expect(result).toBe(true);
    expect(execute).toHaveBeenCalledTimes(2);
    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(false);
  });

  it('undo returns false when stack is empty', () => {
    const history = new HistoryManager();
    expect(history.undo()).toBe(false);
  });

  it('redo returns false when stack is empty', () => {
    const history = new HistoryManager();
    expect(history.redo()).toBe(false);
  });

  it('clears redo stack on new command', () => {
    const history = new HistoryManager();
    history.execute({ execute: vi.fn(), undo: vi.fn() });
    history.undo();
    expect(history.canRedo).toBe(true);

    history.execute({ execute: vi.fn(), undo: vi.fn() });
    expect(history.canRedo).toBe(false);
  });

  it('emits change event on execute', () => {
    const history = new HistoryManager();
    const onChange = vi.fn();
    history.on('change', onChange);

    history.execute({ execute: vi.fn(), undo: vi.fn() });

    expect(onChange).toHaveBeenCalledWith(true, false);
  });

  it('uses the shared keymap helper for layout-independent history shortcuts', () => {
    const undo = new KeyboardEvent('keydown', {
      key: 'я',
      code: 'KeyZ',
      ctrlKey: true,
    });
    const redo = new KeyboardEvent('keydown', {
      key: 'я',
      code: 'KeyZ',
      metaKey: true,
      shiftKey: true,
    });

    expect(getHistoryShortcut(undo)).toBe('undo');
    expect(getHistoryShortcut(redo)).toBe('redo');
  });
});
