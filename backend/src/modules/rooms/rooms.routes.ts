import { Hono } from "hono";
import type { RoomsController } from "./rooms.controller.js";

export const createRoomsRoutes = (controller: RoomsController): Hono => {
  const router = new Hono();

  router.get("/", controller.list);
  router.get("/:id", controller.getById);
  router.post("/", controller.create);
  router.patch("/:id/publish", controller.publish);

  return router;
};
