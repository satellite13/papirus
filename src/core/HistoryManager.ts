import { EventEmitter } from '@/events/EventEmitter';
import type { Command } from '@/types';

/**
 * History events
 */
export interface HistoryEvents {
  change: [canUndo: boolean, canRedo: boolean];
  undo: [command: Command];
  redo: [command: Command];
}

export interface HistoryManagerOptions {
  maxSize?: number;
}

/**
 * Manages undo/redo history using command pattern
 */
export class HistoryManager extends EventEmitter<HistoryEvents> {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private readonly maxSize: number;

  constructor(options: HistoryManagerOptions = {}) {
    super();
    this.maxSize = options.maxSize ?? 100;
  }

  /**
   * Check if undo is available
   */
  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * Check if redo is available
   */
  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Number of commands in undo stack
   */
  get undoCount(): number {
    return this.undoStack.length;
  }

  /**
   * Number of commands in redo stack
   */
  get redoCount(): number {
    return this.redoStack.length;
  }

  /**
   * Execute a command and add to history
   */
  execute(command: Command): void {
    command.execute();
    this.undoStack.push(command);

    // Clear redo stack on new command
    this.redoStack = [];

    // Limit stack size
    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift();
    }

    this.emitChange();
  }

  /**
   * Undo the last command
   */
  undo(): boolean {
    const command = this.undoStack.pop();
    if (command === undefined) {
      return false;
    }

    command.undo();
    this.redoStack.push(command);
    this.emit('undo', command);
    this.emitChange();

    return true;
  }

  /**
   * Redo the last undone command
   */
  redo(): boolean {
    const command = this.redoStack.pop();
    if (command === undefined) {
      return false;
    }

    command.execute();
    this.undoStack.push(command);
    this.emit('redo', command);
    this.emitChange();

    return true;
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.emitChange();
  }

  /**
   * Handle keyboard shortcuts
   */
  handleKeyDown(event: KeyboardEvent): boolean {
    const isCtrlOrMeta = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();

    if (isCtrlOrMeta && key === 'z' && !event.shiftKey) {
      event.preventDefault();
      return this.undo();
    }

    if (isCtrlOrMeta && (key === 'y' || (key === 'z' && event.shiftKey))) {
      event.preventDefault();
      return this.redo();
    }

    return false;
  }

  private emitChange(): void {
    this.emit('change', this.canUndo, this.canRedo);
  }
}

export {
  MoveNodesCommand,
  AddNodeCommand,
  RemoveNodeCommand,
  CompositeCommand,
  ChangeNodePropertiesCommand,
  ChangeEdgePropertiesCommand,
  ChangeGroupPropertiesCommand,
  RemoveNodeFromGroupsCommand,
  createNodeSnapshot,
  createEdgeSnapshot,
  createGroupSnapshot,
} from './history/commands';
