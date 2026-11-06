
import type { Context } from "hono";

import type { RoomsService } from "./rooms.service.js";

import { RoomView } from "./rooms.view.js";

import type { RoomPhotoInput } from "../../domain/index.js";

import { randomUUID } from "node:crypto";

import { mkdir, writeFile } from "node:fs/promises";

import { resolve } from "node:path";

export class RoomsController {
  constructor(private roomsService: RoomsService) {}

  // Obtener habitaciones publicadas
  list = async (c: Context) => {
    try {
      const limit = Number(c.req.query("limit") ?? 20);
      const offset = Number(c.req.query("offset") ?? 0);

      if (
        !Number.isInteger(limit) ||
        !Number.isInteger(offset) ||
        limit < 1 ||
        limit > 100 ||
        offset < 0
      ) {
        return c.json({ error: "Paginación inválida" }, 400);
      }

      const rooms = await this.roomsService.listPublished(limit, offset);

      return c.json(RoomView.toList(rooms), 200);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Error al obtener habitaciones";

      return c.json({ error: message }, 500);
    }
  };

  // Obtener publicaciones de un anfitrión
  listByHost = async (c: Context) => {
    try {
      const hostId = c.req.param("hostId");

      if (!hostId || !hostId.trim()) {
        return c.json(
          { error: "El ID del anfitrión es obligatorio" },
          400
        );
      }

      const rooms = await this.roomsService.listByHost(hostId);

      return c.json(RoomView.toList(rooms), 200);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Error al obtener las publicaciones del anfitrión";

      return c.json({ error: message }, 500);
    }
  };

  // Obtener habitación por ID
  getById = async (c: Context) => {
    try {
      const id = c.req.param("id");

      if (!id) {
        return c.json({ error: "El ID es obligatorio" }, 400);
      }

      const room = await this.roomsService.getById(id);

      return c.json(RoomView.toDetail(room), 200);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Habitación no encontrada";

      return c.json({ error: message }, 404);
    }
  };


  // Obtener fotografía de una habitación
  getPhoto = async (c: Context) => {
    try {
      const listingId = c.req.param("id");
      const photoId = c.req.param("photoId");

      if (!listingId || !photoId) {
        return c.json(
          { error: "El ID de la habitación y de la fotografía son obligatorios." },
          400
        );
      }

      const photo = await this.roomsService.getPhoto(
        listingId,
        photoId
      );

      return c.body(
        new Uint8Array(photo.imageData),
        200,
        {
          "Content-Type": photo.mimeType,
          "Content-Disposition": "inline",
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "private, max-age=3600",
        }
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Error al recuperar la fotografía.";

      return c.json({ error: message }, 404);
    }
  };


  // Subir fotografías al almacenamiento anterior
  // Se conserva este método para no eliminar funcionalidad existente.
  uploadPhotos = async (c: Context) => {
    try {
      const body = await c.req.parseBody({ all: true });
      const received = body["photos"];

      const files = Array.isArray(received)
        ? received
        : received
          ? [received]
          : [];

      if (files.length > 10) {
        return c.json(
          { error: "No puedes enviar más de 10 fotografías." },
          400
        );
      }

      const allowedTypes: Record<string, string> = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
      };

      // Validar todos los archivos antes de guardarlos.
      for (const file of files) {
        if (typeof file === "string" || !allowedTypes[file.type]) {
          return c.json(
            { error: "Solo se permiten imágenes JPG, PNG o WEBP." },
            400
          );
        }

        if (file.size === 0 || file.size > 8 * 1024 * 1024) {
          return c.json(
            { error: "Cada fotografía debe pesar máximo 8 MB." },
            400
          );
        }
      }

      const uploadDirectory = resolve(
        process.cwd(),
        "uploads",
        "rooms"
      );

      await mkdir(uploadDirectory, { recursive: true });

      const urls: string[] = [];

      for (const file of files) {
        if (typeof file === "string") continue;

        const filename = `${randomUUID()}${allowedTypes[file.type]}`;
        const filePath = resolve(uploadDirectory, filename);
        const buffer = Buffer.from(await file.arrayBuffer());

        await writeFile(filePath, buffer);

        const origin = new URL(c.req.url).origin;

        urls.push(`${origin}/uploads/rooms/${filename}`);
      }

      return c.json(
        {
          message: "Fotografías almacenadas correctamente.",
          photos: urls,
        },
        201
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Error al almacenar las fotografías.";

      return c.json({ error: message }, 500);
    }
  };

  // Crear habitación y almacenar sus fotografías en MySQL
  create = async (c: Context) => {
    try {
      const body = await c.req.parseBody({ all: true });

      // Obtener el primer valor de cada campo.
      const getValue = (key: string) => {
        const value = body[key];

        return Array.isArray(value) ? value[0] : value;
      };

      const hostId = getValue("hostId");

      const title =
        getValue("titulo") ?? getValue("title");

      const description =
        getValue("descripcion") ??
        getValue("description") ??
        null;

      const monthlyRent = Number(
        getValue("renta") ?? getValue("monthlyRent")
      );

      const address =
        getValue("ubicacion") ?? getValue("address");

      const latitude = Number(getValue("latitude"));

      const longitude = Number(getValue("longitude"));

      const availableFrom =
        getValue("availableFrom") ?? null;

      const maxRoommatesValue = getValue("maxRoommates");

      const maxRoommates =
        maxRoommatesValue != null && maxRoommatesValue !== ""
          ? Number(maxRoommatesValue)
          : null;

      // Validar usuario
      if (typeof hostId !== "string" || !hostId.trim()) {
        return c.json(
          { error: "El usuario es obligatorio" },
          400
        );
      }

      // Validar título
      if (
        typeof title !== "string" ||
        title.trim().length < 5 ||
        title.trim().length > 200
      ) {
        return c.json(
          {
            error: "El título debe tener entre 5 y 200 caracteres",
          },
          400
        );
      }

      // Validar descripción
      if (
        description !== null &&
        typeof description !== "string"
      ) {
        return c.json(
          { error: "La descripción no es válida" },
          400
        );
      }

      // Validar renta
      if (!Number.isFinite(monthlyRent) || monthlyRent <= 0) {
        return c.json(
          { error: "La renta mensual debe ser mayor a cero" },
          400
        );
      }

      // Validar dirección
      if (
        typeof address !== "string" ||
        !address.trim() ||
        address.trim().length > 500
      ) {
        return c.json(
          { error: "La dirección no es válida" },
          400
        );
      }

      // Validar coordenadas
      if (
        !Number.isFinite(latitude) ||
        latitude < -90 ||
        latitude > 90 ||
        !Number.isFinite(longitude) ||
        longitude < -180 ||
        longitude > 180
      ) {
        return c.json(
          { error: "Las coordenadas de ubicación no son válidas" },
          400
        );
      }

      // Validar compañeros
      if (
        maxRoommates !== null &&
        (!Number.isInteger(maxRoommates) || maxRoommates < 1)
      ) {
        return c.json(
          {
            error: "El número de compañeros debe ser mayor a cero",
          },
          400
        );
      }

      // Validar fecha
      if (
        availableFrom !== null &&
        (
          typeof availableFrom !== "string" ||
          !/^\d{4}-\d{2}-\d{2}$/.test(availableFrom) ||
          Number.isNaN(
            Date.parse(`${availableFrom}T00:00:00`)
          )
        )
      ) {
        return c.json(
          { error: "La fecha de disponibilidad no es válida" },
          400
        );
      }

      // Recibir fotografías
      const receivedPhotos = body["photos"];

      const files = Array.isArray(receivedPhotos)
        ? receivedPhotos
        : receivedPhotos
          ? [receivedPhotos]
          : [];

      // Un borrador puede crearse sin fotografías.
      // Se permite un máximo de 10 fotografías.
      if (files.length > 10) {
        return c.json(
          { error: "No puedes enviar más de 10 fotografías." },
          400
        );
      }

      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
      ];

      const photos: RoomPhotoInput[] = [];

      // Validar y convertir las fotografías a datos binarios.
      for (const file of files) {
        if (
          typeof file === "string" ||
          !allowedTypes.includes(file.type)
        ) {
          return c.json(
            { error: "Solo se permiten imágenes JPG, PNG o WEBP." },
            400
          );
        }

        if (file.size === 0 || file.size > 8 * 1024 * 1024) {
          return c.json(
            { error: "Cada fotografía debe pesar máximo 8 MB." },
            400
          );
        }

        photos.push({
          fileName: file.name || `${randomUUID()}.jpg`,
          mimeType: file.type,
          imageData: Buffer.from(await file.arrayBuffer()),
        });
      }

      // Crear habitación y guardar fotografías en MySQL.
      const room = await this.roomsService.createListing({
        hostId: hostId.trim(),
        title: title.trim(),
        description:
          typeof description === "string"
            ? description.trim()
            : null,
        monthlyRent,
        availableFrom: availableFrom as string | null,
        maxRoommates,
        address: address.trim(),
        latitude,
        longitude,
        photos,
      });

      return c.json(RoomView.toDetail(room), 201);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Error al crear la habitación";

      return c.json({ error: message }, 400);
    }
  };

  // Publicar habitación creada
  publish = async (c: Context) => {
    try {
      const id = c.req.param("id");

      if (!id) {
        return c.json({ error: "El ID es obligatorio" }, 400);
      }

      const room = await this.roomsService.publishListing(id);

      return c.json(
        {
          message: "Habitación publicada correctamente",
          room: RoomView.toDetail(room),
        },
        200
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Error al publicar la habitación";

      return c.json({ error: message }, 400);
    }
  };
}
