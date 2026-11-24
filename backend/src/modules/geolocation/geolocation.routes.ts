import { Hono } from "hono";
import { AppError, errorResponse } from "../../shared/AppError.js";
import { createAuthMiddleware, type AuthService, type AuthVariables } from "../auth/index.js";
import type { RoomsService } from "../rooms/index.js";
import type { GeolocationService } from "./geolocation.service.js";

export function createGeolocationRoutes(geolocation: GeolocationService, rooms: RoomsService, auth: AuthService) {
  const routes = new Hono<{ Variables: AuthVariables }>();
  routes.use("*", createAuthMiddleware(auth));
  routes.onError((cause, context) => {
    const { error, code, status } = errorResponse(cause);
    return context.json({ error, code }, status as 400 | 404 | 503 | 500);
  });

  routes.get("/search", async (context) =>
    context.json({ items: await geolocation.search(context.req.query("q") ?? "") }),
  );

  routes.get("/rooms/:id/nearby", async (context) => {
    const id = context.req.param("id");
    const room = await rooms.getById(id).catch(() => {
      throw new AppError("Habitación no encontrada.", 404, "ROOM_NOT_FOUND");
    });
    if (room.status !== "published" && room.hostId !== context.get("auth").userId) {
      throw new AppError("Habitación no encontrada.", 404, "ROOM_NOT_FOUND");
    }
    const location = await rooms.getLocation(id);
    if (!location) throw new AppError("Esta habitación no tiene ubicación.", 404, "LOCATION_NOT_FOUND");
    return context.json(await geolocation.nearby(location));
  });

  return routes;
}
