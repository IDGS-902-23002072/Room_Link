/*
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

  const router = new Hono<{ Variables: AuthVariables }>();

  const authenticate = createAuthMiddleware(authService);

  // ====================================================
  // RUTAS PÚBLICAS DE CONSULTA
  // ====================================================

  // Consultar publicaciones activas
  router.get("/", controller.list);

  // Consultar publicaciones de un anfitrión
  router.get("/host/:hostId", controller.listByHost);

  // Obtener primera fotografía
  router.get("/:id/photos/first", controller.getFirstPhoto);

  // Obtener fotografía específica
  router.get("/:id/photos/:photoId", controller.getPhoto);

  // Consultar publicación por ID
  router.get("/:id", controller.getById);

  // ====================================================
  // RUTAS PRIVADAS: CREAR Y EDITAR
  // ====================================================

  // Crear publicación como borrador
  router.post("/", authenticate, controller.create);

  // Editar publicación
  router.patch("/:id", authenticate, controller.update);

  // Subir fotografías
  router.post("/photos", authenticate, controller.uploadPhotos);

  // ====================================================
  // RUTAS PRIVADAS: CAMBIOS DE ESTADO
  // ====================================================

  // Publicar un borrador
  router.patch(
    "/:id/publish",
    authenticate,
    controller.publish,
  );

  // Pausar una publicación activa
  router.patch(
    "/:id/pause",
    authenticate,
    controller.pause,
  );

  // Reactivar una publicación pausada
  router.patch(
    "/:id/reactivate",
    authenticate,
    controller.reactivate,
  );

  // Cerrar una publicación cuando se concreta la renta
  router.patch(
    "/:id/close",
    authenticate,
    controller.close,
  );

  return router;
};
*/

import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";

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

  const router = new Hono<{ Variables: AuthVariables }>();

  // ====================================================
  // CONFIGURACIÓN DE AUTENTICACIÓN
  // ====================================================

  const modoPruebas =
    process.env.ROOM_LINK_AUTH_BYPASS === "true";

  const userIdPruebas =
    process.env.ROOM_LINK_TEST_USER_ID?.trim();

  // Evitar que el bypass se utilice en producción.
  if (modoPruebas && process.env.NODE_ENV === "production") {
    throw new Error(
      "No se permite desactivar la autenticación en producción."
    );
  }

  // Verificar que exista un usuario para las pruebas.
  if (modoPruebas && !userIdPruebas) {
    throw new Error(
      "Falta configurar ROOM_LINK_TEST_USER_ID en el .env del backend."
    );
  }

  // Middleware de autenticación:
  // - En pruebas utiliza un usuario simulado.
  // - En funcionamiento normal utiliza la autenticación real.

  const authenticate: MiddlewareHandler<{
    Variables: AuthVariables;
  }> = modoPruebas
    ? async (context, next) => {

        context.set("auth", {
          userId: userIdPruebas!,
          roles: [],
          sessionId: "development-test-session",
        });

        await next();
      }
    : createAuthMiddleware(authService);

  // ====================================================
  // RUTAS PÚBLICAS DE CONSULTA
  // ====================================================

  // Consultar publicaciones activas.
  router.get("/", controller.list);

  // Consultar publicaciones de un anfitrión.
  router.get("/host/:hostId", controller.listByHost);

  // Obtener primera fotografía.
  router.get("/:id/photos/first", controller.getFirstPhoto);

  // Obtener fotografía específica.
  router.get("/:id/photos/:photoId", controller.getPhoto);

  // Consultar publicación por ID.
  router.get("/:id", controller.getById);

  // ====================================================
  // RUTAS PARA CREAR Y EDITAR PUBLICACIONES
  // ====================================================

  // Crear publicación como borrador.
  router.post("/", authenticate, controller.create);

  // Editar publicación.
  router.patch("/:id", authenticate, controller.update);

  // Subir fotografías.
  router.post("/photos", authenticate, controller.uploadPhotos);

  // ====================================================
  // RUTAS PARA CAMBIOS DE ESTADO
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
