import { Hono } from "hono";
import type { MonitoringIngestController } from "./monitoring.controller.js";
import type { MonitoringIngestService } from "./monitoring.service.js";

/** Endpoint de servicio: no usa sesión de usuario, usa token de ingesta. */
export const createMonitoringIngestRoutes = (
  controller: MonitoringIngestController,
  service: MonitoringIngestService,
): Hono => {
  const router = new Hono();

  router.use("*", async (context, next) => {
    if (!service.hasToken(context.req.header("x-monitor-token") ?? undefined)) {
      return context.json(
        {
          accepted: false,
          status: 401,
          code: "INGEST_UNAUTHORIZED",
          error: "Token de ingesta ausente o inválido.",
        },
        401,
      );
    }
    await next();
  });

  router.post("/probe", controller.probe);
  router.post("/backup", controller.backup);
  router.post("/test-run", controller.testRun);

  return router;
};
