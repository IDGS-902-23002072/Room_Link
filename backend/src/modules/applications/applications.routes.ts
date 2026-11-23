import { Hono } from "hono";
import {
  createAuthMiddleware,
  type AuthService,
  type AuthVariables,
} from "../auth/index.js";
import type { ApplicationsController } from "./applications.controller.js";

export const createApplicationsRoutes = (
  controller: ApplicationsController,
  authService: AuthService,
): Hono<{ Variables: AuthVariables }> => {
  const router = new Hono<{ Variables: AuthVariables }>();
  router.use("*", createAuthMiddleware(authService));

  router.post("/", controller.apply);
  router.get("/listing/:listingId", controller.getByListing);
  router.patch("/:id/decide", controller.decide);

  return router;
};
