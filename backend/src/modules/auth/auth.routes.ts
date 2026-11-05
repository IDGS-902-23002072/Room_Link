import { Hono } from "hono";
import type { AuthController } from "./auth.controller.js";
import { createAuthMiddleware, type AuthVariables } from "./auth.middleware.js";
import type { AuthService } from "./auth.service.js";

export const createAuthRoutes = (
  controller: AuthController,
  service: AuthService,
): Hono<{ Variables: AuthVariables }> => {
  const router = new Hono<{ Variables: AuthVariables }>();
  const authenticate = createAuthMiddleware(service);

  router.post("/register", controller.register);
  router.post("/login", controller.login);
  router.post("/oauth/google", controller.google);
  router.post("/password/forgot", controller.forgotPassword);
  router.post("/password/reset", controller.resetPassword);
  router.get("/me", authenticate, controller.me);
  router.post("/logout", authenticate, controller.logout);

  return router;
};
