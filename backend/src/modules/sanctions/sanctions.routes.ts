import { Hono } from "hono";
import {
  createAuthMiddleware,
  requireAdmin,
  type AuthService,
  type AuthVariables,
} from "../auth/index.js";
import type { SanctionsController } from "./sanctions.controller.js";

export const createSanctionsRoutes = (
  controller: SanctionsController,
  authService: AuthService,
): Hono<{ Variables: AuthVariables }> => {
  const router = new Hono<{ Variables: AuthVariables }>();
  router.use("*", createAuthMiddleware(authService), requireAdmin);
  router.post("/", controller.issue);
  router.get("/", controller.listForUser);
  router.delete("/:id", controller.revoke);
  return router;
};
