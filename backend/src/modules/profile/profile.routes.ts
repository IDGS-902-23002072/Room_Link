import { Hono } from "hono";
import {
  createAuthMiddleware,
  requireSelfOrAdmin,
  requireAdmin,
  type AuthService,
  type AuthVariables,
} from "../auth/index.js";
import type { ProfileController } from "./profile.controller.js";

export const createProfileRoutes = (
  controller: ProfileController,
  authService: AuthService,
): Hono<{ Variables: AuthVariables }> => {
  const router = new Hono<{ Variables: AuthVariables }>();
  const authenticate = createAuthMiddleware(authService);
  const self = requireSelfOrAdmin("userId");

  router.get("/verification/pending", authenticate, requireAdmin, controller.listPendingVerifications);
  router.put("/:userId/verification/decision", authenticate, requireAdmin, controller.resolveVerification);

  // Lectura de perfil (requiere sesión)
  router.get("/:userId", authenticate, controller.getProfile);

  // Crear perfil: el userId se toma de la sesión, no del body
  router.post("/", authenticate, controller.createProfile);

  // Mutaciones sobre el propio perfil (solo el dueño o un admin)
  router.put("/:userId", authenticate, self, controller.updateProfile);
  router.put("/:userId/socials", authenticate, self, controller.updateSocials);

  // Galería (HU-02 / EL-02.2 / EL-02.5)
  router.get("/:userId/photos", authenticate, controller.listPhotos);
  router.post("/:userId/photos", authenticate, self, controller.addPhoto);
  router.delete(
    "/:userId/photos/:photoId",
    authenticate,
    self,
    controller.removePhoto,
  );
  router.put("/:userId/photos/order", authenticate, self, controller.reorderPhotos);

  // Privacidad de contacto
  router.get("/:userId/privacy", authenticate, self, controller.getPrivacy);
  router.put("/:userId/privacy", authenticate, self, controller.updatePrivacy);

  // Verificación de identidad
  router.post(
    "/:userId/verification/request",
    authenticate,
    self,
    controller.requestVerification,
  );

  // Preferencias de notificación
  router.get(
    "/:userId/notifications/preferences",
    authenticate,
    self,
    controller.listNotificationPrefs,
  );
  router.put(
    "/:userId/notifications/preferences",
    authenticate,
    self,
    controller.updateNotificationPref,
  );

  return router;
};
