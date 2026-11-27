import { randomUUID } from "node:crypto";
import type { MiddlewareHandler } from "hono";
import type { AuthVariables } from "../modules/auth/index.js";
import { parseSource, shouldExclude, toRoutePattern, type EventSource } from "./routePattern.js";
import { findSliByRoute, SLI_BY_ID } from "./sliCatalog.js";
import { emitMonitorEvent, type BatchedMonitorWriter } from "./writer.js";

const UUID_HEADER =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface RequestLoggerOptions {
  now?: () => number;
  requestId?: () => string;
}

/**
 * Middleware F1. Solo encola registros: no hay `await` de escritura y cualquier
 * fallo del monitoreo se convierte en JSON por stdout.
 */
export const createRequestLogger = (
  writer: BatchedMonitorWriter,
  options: RequestLoggerOptions = {},
): MiddlewareHandler<{ Variables: AuthVariables }> => {
  const now = options.now ?? (() => Date.now());
  const nextRequestId = options.requestId ?? (() => randomUUID());

  return async (context, next) => {
    const startedAt = now();
    let thrown: unknown = null;
    try {
      await next();
    } catch (error) {
      thrown = error;
      throw error;
    } finally {
      const method = context.req.method;
      const path = context.req.path;
      if (!shouldExclude(method, path) && path.startsWith("/api/v1/")) {
        try {
          const durationMs = Math.max(0, now() - startedAt);
          const suppliedId = context.req.header("x-request-id");
          const requestId =
            suppliedId && UUID_HEADER.test(suppliedId) ? suppliedId : nextRequestId();
          const routePattern = toRoutePattern(path);
          const auth = context.get("auth") as AuthVariables["auth"] | undefined;
          const role = auth?.roles[0] ?? null;
          const sli = findSliByRoute(method, routePattern);
          const thresholdMs =
            sli?.thresholdMs ?? SLI_BY_ID.get("T.3")?.thresholdMs ?? 3_000;
          const status = context.res.status || (thrown === null ? 200 : 500);
          const isGood: 0 | 1 = status < 500 && durationMs <= thresholdMs ? 1 : 0;
          const source = parseSource(context.req.header("x-roomlink-source"));

          writer.enqueue({
            kind: "request",
            value: {
              method,
              routePattern,
              status,
              durationMs,
              role,
              requestId,
              sliId: sli?.id ?? null,
              isGood,
              source,
            },
          });

          if (status >= 500) {
            writer.enqueue({
              kind: "error",
              value: {
                module: sli?.module ?? "sistema",
                code: `HTTP_${status}`,
                message: `La petición terminó con el estado HTTP ${status}.`,
                status,
                requestId,
                source,
              },
            });
          }

          if (thrown !== null) {
            writer.enqueue({
              kind: "error",
              value: {
                module: sli?.module ?? "sistema",
                code: "UNHANDLED_EXCEPTION",
                message:
                  "La petición terminó con una excepción no controlada. La respuesta sigue siendo la que devolvió la aplicación.",
                status: status || 500,
                requestId,
                source,
              },
            });
          }
        } catch (error) {
          emitMonitorEvent({
            event: "request_log_failed",
            message: error instanceof Error ? error.message : "error desconocido",
          });
        }
      }
    }
  };
};

export const sourceForEvent = (value: string | undefined): EventSource =>
  parseSource(value);
