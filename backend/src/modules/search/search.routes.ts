import { Hono } from "hono";
import {
  createAuthMiddleware,
  type AuthService,
  type AuthVariables,
} from "../auth/index.js";
import type { SearchController } from "./search.controller.js";

export const createSearchRoutes = (
  controller: SearchController,
  authService: AuthService,
): Hono<{ Variables: AuthVariables }> => {
  const router = new Hono<{ Variables: AuthVariables }>();
  const authenticate = createAuthMiddleware(authService);
  // Búsqueda (HU-05): requiere sesión, consistente con el modelo de auth de develop.
  router.get("/profiles", authenticate, controller.searchProfiles);
  router.get("/listings", authenticate, controller.searchListings);
  router.get("/count", authenticate, controller.countResults);
  return router;
};
