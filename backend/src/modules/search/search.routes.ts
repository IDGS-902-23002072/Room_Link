import { Hono } from "hono";
import type { SearchController } from "./search.controller.js";

export const createSearchRoutes = (controller: SearchController): Hono => {
  const router = new Hono();
  router.get("/profiles", controller.searchProfiles);
  router.get("/listings", controller.searchListings);
  router.get("/count", controller.countResults);
  return router;
};
