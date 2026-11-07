import { Hono } from "hono";
import {
  createAuthMiddleware,
  requireSelfOrAdmin,
  type AuthService,
  type AuthVariables,
} from "../auth/index.js";
import type { CompatibilityController } from "./compatibility.controller.js";

export function createCompatibilityRoutes(
  controller: CompatibilityController,
  authService: AuthService,
): Hono<{ Variables: AuthVariables }> {
  const routes = new Hono<{ Variables: AuthVariables }>();
  routes.use("*", createAuthMiddleware(authService));

  // Todas las rutas requieren que `:userId` coincida con la sesión (o admin)
  routes.get("/:userId", requireSelfOrAdmin("userId"), controller.getTest);
  routes.put("/:userId", requireSelfOrAdmin("userId"), controller.saveTest);
  routes.get("/:userId/feed", requireSelfOrAdmin("userId"), controller.getFeed);
  routes.get(
    "/:userId/candidates/:candidateId",
    requireSelfOrAdmin("userId"),
    controller.getCandidate,
  );
  routes.post(
    "/:userId/connections",
    requireSelfOrAdmin("userId"),
    controller.sendConnectionRequest,
  );
  return routes;
}
