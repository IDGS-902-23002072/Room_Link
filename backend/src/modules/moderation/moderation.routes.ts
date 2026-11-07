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

  // Rutas de denuncia (cualquier usuario autenticado)
  router.post("/reports/listings/:listingId", controller.reportListing);
  router.post("/reports/users/:userId", controller.reportUser);
  router.post("/reports/messages/:messageId", controller.reportMessage);

  // Rutas admin
  router.use("/admin/*", requireAdmin);
  router.get("/admin/reports", controller.allReports);
  router.patch("/admin/reports/:id", controller.resolveReport);
  router.post("/admin/queue/:listingId", controller.enqueue);
  router.get("/admin/queue", controller.queue);
  router.patch("/admin/queue/:listingId", controller.decide);
  router.get("/admin/history", controller.history);

  return router;
};
