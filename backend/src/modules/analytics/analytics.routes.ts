import { Hono } from "hono";
import type { AnalyticsController } from "./analytics.controller.js";

export function createAnalyticsRoutes(controller: AnalyticsController): Hono {
  const routes = new Hono();
  routes.get("/analytics", controller.getDashboard);
  return routes;
}
