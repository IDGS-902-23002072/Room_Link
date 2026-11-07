import { Hono } from "hono";
import {
  createAuthMiddleware,
  type AuthService,
  type AuthVariables,
} from "../auth/index.js";
import type { ConnectionsController } from "./connections.controller.js";

export const createConnectionsRoutes = (
  controller: ConnectionsController,
  authService: AuthService,
): Hono<{ Variables: AuthVariables }> => {
  const router = new Hono<{ Variables: AuthVariables }>();
  router.use("*", createAuthMiddleware(authService));
  router.get("/", controller.list);
  router.patch("/:id", controller.respond);
  router.delete("/:id", controller.cancel);
  return router;
};
