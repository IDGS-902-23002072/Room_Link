import { Hono } from "hono";
import {
  createAuthMiddleware,
  requireAdmin,
  type AuthService,
  type AuthVariables,
} from "../auth/index.js";
import type { ActivityLogController } from "./activity-log.controller.js";

export const createActivityLogRoutes = (
  controller: ActivityLogController,
  authService: AuthService,
): Hono<{ Variables: AuthVariables }> => {
  const router = new Hono<{ Variables: AuthVariables }>();
  router.use("*", createAuthMiddleware(authService), requireAdmin);
  router.get("/", controller.list);
  return router;
};
