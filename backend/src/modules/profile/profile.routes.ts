import { Hono } from "hono";
import type { ProfileController } from "./profile.controller.js";

export const createProfileRoutes = (controller: ProfileController): Hono => {
  const router = new Hono();

  router.get("/:userId", controller.getProfile);
  router.post("/", controller.createProfile);
  router.put("/:userId", controller.updateProfile);

  return router;
};
