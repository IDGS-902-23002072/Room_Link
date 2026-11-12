import { Hono } from "hono";
import {
  createAuthMiddleware,
  type AuthService,
  type AuthVariables,
} from "../auth/index.js";
import type { RoomsController } from "./rooms.controller.js";

export const createRoomsRoutes = (
  controller: RoomsController,
  authService: AuthService,
): Hono<{ Variables: AuthVariables }> => {
  const router = new Hono<{ Variables: AuthVariables }>();
  const authenticate = createAuthMiddleware(authService);

  // Rutas públicas de consulta
  router.get("/", controller.list);
  router.get("/host/:hostId", controller.listByHost);
  router.get("/:id/photos/first", controller.getFirstPhoto);
  router.get("/:id/photos/:photoId", controller.getPhoto);
  router.get("/:id", controller.getById);

  // Rutas que requieren sesión; el hostId viene de la sesión, no del body
  router.post("/", authenticate, controller.create);
  router.patch("/:id/publish", authenticate, controller.publish);
  router.patch("/:id", authenticate, controller.update);
  router.post("/photos", authenticate, controller.uploadPhotos);

  return router;
};
