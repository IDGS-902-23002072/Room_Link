import type { DomainEventPublisher } from "../auth/index.js";

export interface DomainEvent {
  type: string;
  aggregateId: string;
  payload: Record<string, unknown>;
}

export type DomainEventListener = (event: DomainEvent) => void | Promise<void>;

/**
 * Publisher compuesto: delega la persistencia (típicamente en `coreOutboxEvents`)
 * y además notifica a los suscriptores en proceso. Los errores de los listeners
 * se loguean pero NO propagan: la publicación del evento sigue siendo exitosa.
 */
export class InProcessEventBus implements DomainEventPublisher {
  private readonly listeners: DomainEventListener[] = [];

  constructor(private readonly outbox: DomainEventPublisher) {}

  async publish(event: DomainEvent): Promise<void> {
    await this.outbox.publish(event);
    for (const listener of this.listeners) {
      try {
        await listener(event);
      } catch (error) {
        if (process.env.NODE_ENV !== "test") {
          console.error("Listener de evento falló", { event: event.type, error });
        }
      }
    }
  }

  subscribe(listener: DomainEventListener): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) this.listeners.splice(index, 1);
    };
  }
}
