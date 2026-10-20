import { Hono } from "hono";
import type { AuthController } from "./auth.controller.js";

export const createAuthRoutes = (controller: AuthController): Hono => {
  const router = new Hono();

  router.post("/register", controller.register);
  router.post("/login", controller.login);
  router.get("/me", controller.me);

  return router;
};
