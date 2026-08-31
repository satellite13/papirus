/**
 * Type-safe event emitter with support for typed event maps
 */
type EventListener = (...args: unknown[]) => void;

export class EventEmitter<TEvents extends { [K in keyof TEvents]: unknown[] }> {
  private listeners = new Map<keyof TEvents, Set<EventListener>>();
  /** Maps original once-listeners to their wrappers so `off(event, original)` works. */
  private onceWrappers = new Map<keyof TEvents, Map<EventListener, Set<EventListener>>>();

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
    const eventListener = listener as EventListener;
    const listeners = this.listeners.get(event);
    listeners?.delete(eventListener);

    const wrappersByListener = this.onceWrappers.get(event);
    const wrappers = wrappersByListener?.get(eventListener);
    if (wrappers !== undefined) {
      for (const wrapper of wrappers) {
        listeners?.delete(wrapper);
      }
      wrappersByListener?.delete(eventListener);
    } else if (wrappersByListener !== undefined) {
      // The unsubscribe function returned by once() passes the wrapper itself.
      for (const [original, originalWrappers] of wrappersByListener) {
        originalWrappers.delete(eventListener);
        if (originalWrappers.size === 0) {
          wrappersByListener.delete(original);
        }
      }
    }

    if (listeners?.size === 0) {
      this.listeners.delete(event);
    }
    if (wrappersByListener?.size === 0) {
      this.onceWrappers.delete(event);
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
    const originalListener = listener as EventListener;
    const eventWrapper = wrapper as EventListener;
    let wrappersByListener = this.onceWrappers.get(event);
    if (wrappersByListener === undefined) {
      wrappersByListener = new Map();
      this.onceWrappers.set(event, wrappersByListener);
    }
    let wrappers = wrappersByListener.get(originalListener);
    if (wrappers === undefined) {
      wrappers = new Set();
      wrappersByListener.set(originalListener, wrappers);
    }
    wrappers.add(eventWrapper);
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
      for (const listener of Array.from(listeners)) {
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
      this.onceWrappers.delete(event);
    } else {
      this.listeners.clear();
      this.onceWrappers.clear();
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
