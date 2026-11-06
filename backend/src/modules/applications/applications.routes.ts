import { Hono } from "hono";
import type { ApplicationsController } from "./applications.controller.js";

export const createApplicationsRoutes = (controller: ApplicationsController): Hono => {
  const router = new Hono();

  router.post("/", controller.apply);
  router.get("/listing/:listingId", controller.getByListing);
  router.patch("/:id/decide", controller.decide);

  return router;
};
