import { Hono } from "hono";
import {
  createAuthMiddleware,
  requireAdmin,
  type AuthService,
  type AuthVariables,
} from "../auth/index.js";
import type { AnalyticsController } from "./analytics.controller.js";

export const createAnalyticsRoutes = (
  controller: AnalyticsController,
  authService: AuthService,
): Hono<{ Variables: AuthVariables }> => {
  const router = new Hono<{ Variables: AuthVariables }>();
  router.use("*", createAuthMiddleware(authService), requireAdmin);
  router.get("/", controller.getRange);
  router.post("/recompute", controller.recompute);
  return router;
};
