import { Hono } from "hono";
import {
  createAuthMiddleware,
  requireAdmin,
  type AuthService,
  type AuthVariables,
} from "../auth/index.js";
import type { MonitoringAdminController } from "./monitoring-admin.controller.js";

/** Solo lectura, mismo middleware de auth y rol que analytics. */
export const createMonitoringAdminRoutes = (
  controller: MonitoringAdminController,
  authService: AuthService,
): Hono<{ Variables: AuthVariables }> => {
  const router = new Hono<{ Variables: AuthVariables }>();
  const guard = [createAuthMiddleware(authService), requireAdmin] as const;
  // No se usa `use("*")`: la ingesta por token vive bajo el mismo prefijo.
  router.get("/summary", ...guard, controller.summary);
  router.get("/slis", ...guard, controller.slis);
  router.get("/tests/runs", ...guard, controller.runs);
  router.get("/tests/runs/:id", ...guard, controller.run);
  router.get("/logbook", ...guard, controller.logbook);
  router.get("/export/requests.csv", ...guard, controller.exportRequests);
  return router;
};
