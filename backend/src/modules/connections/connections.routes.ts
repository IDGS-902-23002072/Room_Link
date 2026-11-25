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

  // Consultar solicitudes.
  router.get("/", controller.list);

  // Enviar solicitud.
  router.post("/", controller.create);

  // Aceptar o rechazar.
  router.patch("/:id", controller.respond);

  // Cancelar solicitud.
  router.delete("/:id", controller.cancel);

  return router;
};
