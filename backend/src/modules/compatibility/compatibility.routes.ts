import { Hono } from "hono";
import type { CompatibilityController } from "./compatibility.controller.js";

export function createCompatibilityRoutes(controller: CompatibilityController): Hono {
  const routes = new Hono();
  routes.get("/:userId", controller.getTest);
  routes.put("/:userId", controller.saveTest);
  routes.get("/:userId/feed", controller.getFeed);
  routes.get("/:userId/candidates/:candidateId", controller.getCandidate);
  routes.post("/:userId/connections", controller.sendConnectionRequest);
  return routes;
}
