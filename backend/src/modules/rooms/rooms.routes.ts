
import { Hono } from "hono";

import {
  createAuthMiddleware,
  type AuthService,
  type AuthVariables,
} from "../auth/index.js";

import type { RoomsController } from "./rooms.controller.js";

// ======================================================
// RUTAS DE HABITACIONES
// ======================================================

export const createRoomsRoutes = (
  controller: RoomsController,
  authService: AuthService,
): Hono<{ Variables: AuthVariables }> => {

  const router = new Hono<{
    Variables: AuthVariables;
  }>();

  // ====================================================
  // AUTENTICACIÓN
  // ====================================================

  const authenticate = createAuthMiddleware(authService);

  // ====================================================
  // RUTAS PÚBLICAS DE CONSULTA
  // ====================================================

  // Consultar publicaciones activas.
  router.get("/", controller.list);

  // Feed de habitaciones publicadas (HU-04).
  router.get("/feed", controller.feed);

  // ====================================================
  // RUTAS PRIVADAS DE CONSULTA
  // ====================================================

  // Consultar todas las publicaciones del anfitrión autenticado.
  router.get(
    "/host/:hostId",
    authenticate,
    controller.listByHost,
  );

  // Obtener primera fotografía de una publicación.
  router.get("/:id/photos/first", controller.getFirstPhoto);

  // Obtener una fotografía específica.
  router.get("/:id/photos/:photoId", controller.getPhoto);

  // Consultar una publicación por su ID.
  router.get("/:id", controller.getById);

  // ====================================================
  // RUTAS PRIVADAS: CREAR Y EDITAR
  // ====================================================

  // Crear una publicación como borrador.
  router.post(
    "/",
    authenticate,
    controller.create,
  );

  // Actualizar una publicación existente.
  router.patch(
    "/:id",
    authenticate,
    controller.update,
  );

  // Procesar fotografías.
  router.post(
    "/photos",
    authenticate,
    controller.uploadPhotos,
  );

  // ====================================================
  // RUTAS PRIVADAS: CAMBIOS DE ESTADO
  // ====================================================

  // Publicar un borrador.
  router.patch(
    "/:id/publish",
    authenticate,
    controller.publish,
  );

  // Pausar una publicación activa.
  router.patch(
    "/:id/pause",
    authenticate,
    controller.pause,
  );

  // Reactivar una publicación pausada.
  router.patch(
    "/:id/reactivate",
    authenticate,
    controller.reactivate,
  );

  // Cerrar una publicación.
  router.patch(
    "/:id/close",
    authenticate,
    controller.close,
  );

  return router;
};
