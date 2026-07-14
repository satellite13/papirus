import { shallowEqual } from '@/utils/style';
import type { DiagramSurface } from './DiagramSurface';
import {
  ChangeEdgePropertiesCommand,
  ChangeGroupPropertiesCommand,
  ChangeNodePropertiesCommand,
} from './HistoryManager';
import type { HistoryManager } from './HistoryManager';
import type { EdgeSnapshot, GroupSnapshot, NodeSnapshot } from './history/commands';

export type PropertyChangeKind = 'node' | 'edge' | 'group';
export type PropertySnapshot = NodeSnapshot | EdgeSnapshot | GroupSnapshot;

export interface PropertyChangeBatcherOptions {
  renderer: DiagramSurface;
  historyManager: HistoryManager;
  debounceMs?: number;
}

interface PendingPropertyChange {
  kind: PropertyChangeKind;
  id: string;
  before: PropertySnapshot;
  after: PropertySnapshot;
  timerId: number;
}

export class PropertyChangeBatcher {
  private readonly renderer: DiagramSurface;
  private readonly historyManager: HistoryManager;
  private readonly debounceMs: number;
  private readonly pendingChanges = new Map<string, PendingPropertyChange>();

  constructor(options: PropertyChangeBatcherOptions) {
    this.renderer = options.renderer;
    this.historyManager = options.historyManager;
    this.debounceMs = options.debounceMs ?? 350;
  }

  queue(
    kind: PropertyChangeKind,
    id: string,
    before: PropertySnapshot,
    after: PropertySnapshot
  ): void {
    const key = `${kind}:${id}`;
    const existing = this.pendingChanges.get(key);
    if (existing) {
      existing.after = after;
      window.clearTimeout(existing.timerId);
      existing.timerId = window.setTimeout(() => this.flushOne(key), this.debounceMs);
      return;
    }

    const timerId = window.setTimeout(() => this.flushOne(key), this.debounceMs);
    this.pendingChanges.set(key, { kind, id, before, after, timerId });
  }

  flush(): void {
    for (const key of Array.from(this.pendingChanges.keys())) {
      this.flushOne(key);
    }
  }

  private flushOne(key: string): void {
    const pending = this.pendingChanges.get(key);
    if (!pending) {
      return;
    }
    window.clearTimeout(pending.timerId);
    this.pendingChanges.delete(key);
    if (shallowEqual(pending.before as object, pending.after as object)) {
      return;
    }

    switch (pending.kind) {
      case 'node':
        this.historyManager.execute(
          new ChangeNodePropertiesCommand(
            (id) => this.renderer.getNode(id),
            pending.id,
            pending.before as NodeSnapshot,
            pending.after as NodeSnapshot
          )
        );
        break;
      case 'edge':
        this.historyManager.execute(
          new ChangeEdgePropertiesCommand(
            (id) => this.renderer.getEdge(id),
            pending.id,
            pending.before as EdgeSnapshot,
            pending.after as EdgeSnapshot
          )
        );
        break;
      case 'group':
        this.historyManager.execute(
          new ChangeGroupPropertiesCommand(
            (id) => this.renderer.getGroup(id),
            pending.id,
            pending.before as GroupSnapshot,
            pending.after as GroupSnapshot
          )
        );
        break;
    }
    this.renderer.markStyleDirty();
  }
}
