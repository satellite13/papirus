/**
 * Type-safe event emitter with support for typed event maps
 */
export class EventEmitter<TEvents extends { [K in keyof TEvents]: unknown[] }> {
  private listeners = new Map<keyof TEvents, Set<(...args: unknown[]) => void>>();

  /**
   * Subscribe to an event
   * @param event - Event name
   * @param listener - Callback function
   * @returns Unsubscribe function
   */
  on<K extends keyof TEvents>(event: K, listener: (...args: TEvents[K]) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const listeners = this.listeners.get(event)!;
    listeners.add(listener as (...args: unknown[]) => void);

    return () => {
      this.off(event, listener);
    };
  }

  /**
   * Unsubscribe from an event
   * @param event - Event name
   * @param listener - Callback function to remove
   */
  off<K extends keyof TEvents>(event: K, listener: (...args: TEvents[K]) => void): void {
    const listeners = this.listeners.get(event);
    if (listeners !== undefined) {
      listeners.delete(listener as (...args: unknown[]) => void);
    }
  }

  /**
   * Subscribe to an event for a single emission
   * @param event - Event name
   * @param listener - Callback function
   * @returns Unsubscribe function
   */
  once<K extends keyof TEvents>(event: K, listener: (...args: TEvents[K]) => void): () => void {
    const wrapper = (...args: TEvents[K]): void => {
      this.off(event, wrapper);
      listener(...args);
    };
    return this.on(event, wrapper);
  }

  /**
   * Emit an event to all subscribers
   * @param event - Event name
   * @param args - Event arguments
   */
  emit<K extends keyof TEvents>(event: K, ...args: TEvents[K]): void {
    const listeners = this.listeners.get(event);
    if (listeners !== undefined) {
      for (const listener of listeners) {
        listener(...args);
      }
    }
  }

  /**
   * Remove all listeners for an event or all events
   * @param event - Optional event name. If not provided, removes all listeners
   */
  removeAllListeners<K extends keyof TEvents>(event?: K): void {
    if (event !== undefined) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Get the number of listeners for an event
   * @param event - Event name
   * @returns Number of listeners
   */
  listenerCount<K extends keyof TEvents>(event: K): number {
    const listeners = this.listeners.get(event);
    return listeners?.size ?? 0;
  }
}
