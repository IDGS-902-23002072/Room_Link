import type { ActivityLogService } from "./activity-log.service.js";
import type { DomainEvent, InProcessEventBus } from "../notifications/event-bus.js";

/**
 * Suscribe al bus de dominio y persiste cada evento como una entrada de
 * `mod_activity_log` con `action = event.type` y `metadata = payload`.
 * Si el payload trae `userId`, se usa como actor; de lo contrario queda nulo.
 */
export class ActivityLogConsumer {
  constructor(private readonly service: ActivityLogService) {}

  register(bus: InProcessEventBus): () => void {
    return bus.subscribe((event) => this.handle(event));
  }

  async handle(event: DomainEvent): Promise<void> {
    const userId =
      typeof event.payload.userId === "string"
        ? event.payload.userId
        : typeof event.payload.actorId === "string"
          ? (event.payload.actorId as string)
          : typeof event.payload.adminId === "string"
            ? (event.payload.adminId as string)
            : null;
    const ipAddress =
      typeof event.payload.ipAddress === "string"
        ? (event.payload.ipAddress as string)
        : null;
    await this.service.log({
      userId,
      action: event.type,
      metadata: event.payload,
      ipAddress,
    });
  }
}
