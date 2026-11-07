import { Hono } from "hono";
import {
  createAuthMiddleware,
  requireSelfOrAdmin,
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

  router.get("/:userId", authenticate, controller.getProfile);
  router.post("/", authenticate, controller.createProfile);
  router.put("/:userId", authenticate, requireSelfOrAdmin("userId"), controller.updateProfile);

  return router;
};
