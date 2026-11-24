
import type { MiddlewareHandler } from "hono";
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
  const requireHost: MiddlewareHandler<{ Variables: AuthVariables }> = async (context, next) => {
    const roles = context.get("auth").roles;
    if (!roles.includes("host") && !roles.includes("admin")) {
      return context.json({ error: "Activa el rol de arrendador para gestionar anuncios.", code: "HOST_REQUIRED" }, 403);
    }
    await next();
  };

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

  // Reglas de la casa y desglose de costos (HU-06 / M08).
  router.get("/:id/rules", controller.getRules);
  router.put("/:id/rules", authenticate, requireHost, controller.updateRules);
  router.get("/:id/costs", controller.getCostItems);
  router.put("/:id/costs", authenticate, requireHost, controller.updateCostItems);

  // Consultar una publicación por su ID.
  router.get("/:id", controller.getById);

  // ====================================================
  // RUTAS PRIVADAS: CREAR Y EDITAR
  // ====================================================

  // Crear una publicación como borrador.
  router.post(
    "/",
    authenticate,
    requireHost,
    controller.create,
  );

  // Actualizar una publicación existente.
  router.patch(
    "/:id",
    authenticate,
    requireHost,
    controller.update,
  );

  // Procesar fotografías.
  router.post(
    "/photos",
    authenticate,
    requireHost,
    controller.uploadPhotos,
  );

  // ====================================================
  // RUTAS PRIVADAS: CAMBIOS DE ESTADO
  // ====================================================

  // Publicar un borrador.
  router.patch(
    "/:id/publish",
    authenticate,
    requireHost,
    controller.publish,
  );

  // Pausar una publicación activa.
  router.patch(
    "/:id/pause",
    authenticate,
    requireHost,
    controller.pause,
  );

  // Reactivar una publicación pausada.
  router.patch(
    "/:id/reactivate",
    authenticate,
    requireHost,
    controller.reactivate,
  );

  // Cerrar una publicación.
  router.patch(
    "/:id/close",
    authenticate,
    requireHost,
    controller.close,
  );

  return router;
};
