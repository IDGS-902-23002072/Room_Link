import type { DomainEventListener } from "../modules/notifications/event-bus.js";
import { describeDomainEvent } from "./messageBuilder.js";
import { parseSource, type EventSource } from "./routePattern.js";
import { emitMonitorEvent, type BatchedMonitorWriter } from "./writer.js";

/** Convierte eventos de dominio en entradas legibles de la bitácora. */
export const createMonitorActivityListener = (
  writer: BatchedMonitorWriter,
  source: EventSource = "real",
): DomainEventListener => {
  const eventSource = parseSource(source);
  return (event) => {
    try {
      const described = describeDomainEvent(event, eventSource);
      writer.enqueue({
        kind: "activity",
        value: {
          module: described.module,
          action: described.action,
          result: described.result,
          message: described.message,
          actorId: described.actorId,
          source: described.source,
          detail: described.detail,
          occurredAt: new Date(),
        },
      });
    } catch (error) {
      emitMonitorEvent({
        event: "activity_log_failed",
        action: event.type,
        message: error instanceof Error ? error.message : "error desconocido",
      });
    }
  };
};
