import { Hono } from "hono";
import {
  createAuthMiddleware,
  type AuthService,
  type AuthVariables,
} from "../auth/index.js";
import type { NotificationsController } from "./notifications.controller.js";

export const createNotificationsRoutes = (
  controller: NotificationsController,
  authService: AuthService,
): Hono<{ Variables: AuthVariables }> => {
  const router = new Hono<{ Variables: AuthVariables }>();
  router.use("*", createAuthMiddleware(authService));
  router.get("/", controller.list);
  router.post("/mark-all-read", controller.markAllRead);
  router.patch("/:id/read", controller.markRead);
  router.get("/preferences", controller.getPreferences);
  router.put("/preferences", controller.updatePreferences);
  return router;
};
