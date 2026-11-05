import { Hono } from "hono";
import {
  createAuthMiddleware,
  requireAdmin,
  type AuthService,
  type AuthVariables,
} from "../auth/index.js";
import type { ModerationController } from "./moderation.controller.js";

export const createModerationRoutes = (
  controller: ModerationController,
  authService: AuthService,
): Hono<{ Variables: AuthVariables }> => {
  const router = new Hono<{ Variables: AuthVariables }>();
  router.use("*", createAuthMiddleware(authService));
  router.post("/reports/listings/:listingId", controller.reportListing);
  router.use("/admin/*", requireAdmin);
  router.get("/admin/reports", controller.reports);
  router.post("/admin/queue/:listingId", controller.enqueue);
  router.get("/admin/queue", controller.queue);
  router.patch("/admin/queue/:listingId", controller.decide);
  router.get("/admin/history", controller.history);
  return router;
};
