import { Hono } from "hono";
import { createAuthMiddleware, type AuthService, type AuthVariables } from "../auth/index.js";
import type { MessagingController } from "./messaging.controller.js";

export const createMessagingRoutes = (
  controller: MessagingController,
  authService: AuthService,
): Hono<{ Variables: AuthVariables }> => {
  const router = new Hono<{ Variables: AuthVariables }>();
  router.use("*", createAuthMiddleware(authService));
  router.get("/", controller.inbox);
  router.post("/rooms", controller.openRoom);
  router.get("/rooms/:roomId/messages", controller.messages);
  router.post("/rooms/:roomId/messages", controller.send);
  router.patch("/rooms/:roomId/delivered", controller.delivered);
  router.patch("/rooms/:roomId/read", controller.read);
  router.get("/rooms/:roomId/context", controller.context);
  router.get("/rooms/:roomId/events", controller.eventsStream);
  return router;
};
