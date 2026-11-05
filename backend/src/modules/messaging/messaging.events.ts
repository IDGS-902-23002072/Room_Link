import type { MessageEvent, MessageEventPublisher } from "./messaging.ports.js";

export class InMemoryMessageEventPublisher implements MessageEventPublisher {
  private readonly listeners = new Map<string, Set<(event: MessageEvent) => void>>();

  publish(roomId: string, event: MessageEvent): void {
    queueMicrotask(() => {
      for (const listener of this.listeners.get(roomId) ?? []) listener(event);
    });
  }

  subscribe(roomId: string, listener: (event: MessageEvent) => void): () => void {
    const roomListeners = this.listeners.get(roomId) ?? new Set();
    roomListeners.add(listener);
    this.listeners.set(roomId, roomListeners);
    return () => {
      roomListeners.delete(listener);
      if (roomListeners.size === 0) this.listeners.delete(roomId);
    };
  }
}
