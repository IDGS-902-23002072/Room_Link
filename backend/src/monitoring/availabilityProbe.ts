import { randomUUID } from "node:crypto";
import type { Context } from "hono";
import { describeProbe } from "./messageBuilder.js";
import { parseSource } from "./routePattern.js";
import { UUID_HEADER } from "./requestLogger.js";
import { emitMonitorEvent, type BatchedMonitorWriter } from "./writer.js";

export type ProbeTarget = "/health" | "/ready";

/**
 * Registra cada sondeo de disponibilidad en `mon_probe`. No forma parte de los
 * SLI de transacción: `/health` y `/ready` siguen excluidos del F1.
 * Nunca espera a la base y cualquier fallo se reporta como JSON por stdout.
 */
export function recordAvailabilityProbe(
  writer: BatchedMonitorWriter,
  context: Context,
  target: ProbeTarget,
  status: "up" | "down",
  httpStatus: number,
  startedAt: number,
): void {
  try {
    const suppliedId = context.req.header("x-request-id");
    const requestId = suppliedId && UUID_HEADER.test(suppliedId) ? suppliedId : randomUUID();
    writer.enqueue({
      kind: "probe",
      value: {
        checkedAt: new Date(),
        status,
        httpStatus,
        latencyMs: Math.max(0, Date.now() - startedAt),
        requestId,
        source: parseSource(context.req.header("x-roomlink-source")),
        message: describeProbe(target, status, httpStatus),
      },
    });
  } catch (error) {
    emitMonitorEvent({
      event: "probe_log_failed",
      target,
      message: error instanceof Error ? error.message : "error desconocido",
    });
  }
}
