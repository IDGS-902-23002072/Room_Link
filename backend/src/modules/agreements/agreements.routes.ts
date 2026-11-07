import { Hono } from "hono";
import {
  createAuthMiddleware,
  type AuthService,
  type AuthVariables,
} from "../auth/index.js";
import type { AgreementsController } from "./agreements.controller.js";

export const createAgreementsRoutes = (
  controller: AgreementsController,
  authService: AuthService,
): Hono<{ Variables: AuthVariables }> => {
  const router = new Hono<{ Variables: AuthVariables }>();
  router.use("*", createAuthMiddleware(authService));
  router.post("/", controller.create);
  router.get("/:id", controller.getById);
  router.post("/:id/accept", controller.accept);
  router.get("/:id/acceptances", controller.listAcceptances);
  return router;
};
