import type { Context } from "hono";
import type { RoomsService } from "./rooms.service.js";
import { RoomView } from "./rooms.view.js";

export class RoomsController {
  constructor(private roomsService: RoomsService) {}

  list = async (c: Context) => {
    try {
      const limit = Number(c.req.query("limit") ?? 20);
      const offset = Number(c.req.query("offset") ?? 0);
      const rooms = await this.roomsService.listPublished(limit, offset);
      return c.json(RoomView.toList(rooms), 200);
    } catch (err: any) {
      return c.json({ error: err.message ?? "Error al obtener habitaciones" }, 500);
    }
  };

  getById = async (c: Context) => {
    try {
      const id = c.req.param("id");
      if (!id) {
        return c.json({ error: "id es obligatorio" }, 400);
      }
      const room = await this.roomsService.getById(id);
      return c.json(RoomView.toDetail(room), 200);
    } catch (err: any) {
      return c.json({ error: err.message ?? "Habitación no encontrada" }, 404);
    }
  };

  create = async (c: Context) => {
    try {
      const body = await c.req.json();
      if (!body.hostId || !body.title || !body.monthlyRent) {
        return c.json(
          { error: "hostId, title y monthlyRent son obligatorios" },
          400,
        );
      }

      const room = await this.roomsService.createListing({
        hostId: body.hostId,
        title: body.title,
        description: body.description ?? null,
        monthlyRent: Number(body.monthlyRent),
        availableFrom: body.availableFrom ?? null,
        maxRoommates: body.maxRoommates ? Number(body.maxRoommates) : null,
      });

      return c.json(RoomView.toDetail(room), 201);
    } catch (err: any) {
      return c.json({ error: err.message ?? "Error al crear habitación" }, 400);
    }
  };

  publish = async (c: Context) => {
    try {
      const id = c.req.param("id");
      if (!id) {
        return c.json({ error: "id es obligatorio" }, 400);
      }
      const room = await this.roomsService.publishListing(id);
      return c.json(
        {
          message: "Habitación publicada correctamente",
          room: RoomView.toDetail(room),
        },
        200,
      );
    } catch (err: any) {
      return c.json({ error: err.message ?? "Error al publicar habitación" }, 400);
    }
  };
}
