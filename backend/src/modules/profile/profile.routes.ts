import { Hono } from "hono";
import type { ProfileController } from "./profile.controller.js";

export const createProfileRoutes = (controller: ProfileController): Hono => {
  const router = new Hono();

  // Perfil base
  router.get("/:userId", controller.getProfile);
  router.post("/", controller.createProfile);
  router.put("/:userId", controller.updateProfile);
  router.put("/:userId/socials", controller.updateSocials);

  // Galería (HU-02 / EL-02.2 / EL-02.5)
  router.get("/:userId/photos", controller.listPhotos);
  router.post("/:userId/photos", controller.addPhoto);
  router.delete("/:userId/photos/:photoId", controller.removePhoto);
  router.put("/:userId/photos/order", controller.reorderPhotos);

  // Privacidad de contacto
  router.get("/:userId/privacy", controller.getPrivacy);
  router.put("/:userId/privacy", controller.updatePrivacy);

  // Verificación de identidad
  router.post("/:userId/verification/request", controller.requestVerification);

  // Preferencias de notificación
  router.get("/:userId/notifications/preferences", controller.listNotificationPrefs);
  router.put(
    "/:userId/notifications/preferences",
    controller.updateNotificationPref,
  );

  return router;
};
