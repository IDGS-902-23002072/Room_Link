
import type { Context } from "hono";
import type { RoomsService } from "./rooms.service.js";
import { RoomView } from "./rooms.view.js";
import type { AuthVariables } from "../auth/index.js";
import type {
  RoomPhotoInput,
  RoomPhotoUpdateItem,
} from "../../domain/index.js";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

type AuthContext = Context<{ Variables: AuthVariables }>;

type FormValue = string | File | undefined;

const TIPOS_IMAGEN = ["image/jpeg", "image/png", "image/webp"];
const TAMANO_MAXIMO = 8 * 1024 * 1024;

function obtenerValor(
  body: Record<string, string | File | (string | File)[]>,
  key: string
): FormValue {
  const value = body[key];

  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function obtenerTexto(value: FormValue): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function obtenerArchivos(
  body: Record<string, string | File | (string | File)[]>,
  key: string
): (string | File)[] {
  const value = body[key];

  if (Array.isArray(value)) {
    return value;
  }

  return value ? [value] : [];
}

function fechaValida(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function esObjeto(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class RoomsController {
  constructor(private roomsService: RoomsService) { }

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

      if (!hostId?.trim()) {
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

  // Obtener habitación por ID con ubicación y fotografías
  getById = async (c: Context) => {
    try {
      const id = c.req.param("id");

      if (!id) {
        return c.json({ error: "El ID es obligatorio" }, 400);
      }

      const room = await this.roomsService.getById(id);

      const [location, photos] = await Promise.all([
        this.roomsService.getLocation(id),
        this.roomsService.getPhotos(id),
      ]);

      return c.json(
        {
          ...RoomView.toDetail(room),
          location,
          photos,
        },
        200
      );
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
          {
            error: "El ID de la habitación y de la fotografía son obligatorios.",
          },
          400
        );
      }

      const photo = await this.roomsService.getPhoto(listingId, photoId);

      return c.body(new Uint8Array(photo.imageData), 200, {
        "Content-Type": photo.mimeType,
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=3600",
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Error al recuperar la fotografía.";

      return c.json({ error: message }, 404);
    }
  };

  // Obtener primera fotografía de una habitación
  getFirstPhoto = async (c: Context) => {
    try {
      const listingId = c.req.param("id");

      if (!listingId) {
        return c.json(
          { error: "El ID de la habitación es obligatorio." },
          400
        );
      }

      const photo = await this.roomsService.getFirstPhoto(listingId);

      return c.body(new Uint8Array(photo.imageData), 200, {
        "Content-Type": photo.mimeType,
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=3600",
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Error al recuperar la primera fotografía.";

      return c.json({ error: message }, 404);
    }
  };

  // Subir fotografías al almacenamiento anterior
  uploadPhotos = async (c: AuthContext) => {
    try {
      const body = await c.req.parseBody({ all: true });
      const files = obtenerArchivos(body, "photos");

      if (files.length > 10) {
        return c.json(
          { error: "No puedes enviar más de 10 fotografías." },
          400
        );
      }

      const extensiones: Record<string, string> = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
      };

      for (const file of files) {
        if (typeof file === "string" || !extensiones[file.type]) {
          return c.json(
            { error: "Solo se permiten imágenes JPG, PNG o WEBP." },
            400
          );
        }

        if (file.size === 0 || file.size > TAMANO_MAXIMO) {
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
      const origin = new URL(c.req.url).origin;

      for (const file of files) {
        if (typeof file === "string") continue;

        const filename = `${randomUUID()}${extensiones[file.type]}`;
        const filePath = resolve(uploadDirectory, filename);
        const buffer = Buffer.from(await file.arrayBuffer());

        await writeFile(filePath, buffer);

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
  create = async (c: AuthContext) => {
    try {
      const body = await c.req.parseBody({ all: true });

      const hostId = c.get("auth").userId;

      const title = obtenerTexto(
        obtenerValor(body, "titulo") ??
        obtenerValor(body, "title")
      );

      const descriptionValue =
        obtenerValor(body, "descripcion") ??
        obtenerValor(body, "description");

      const description = obtenerTexto(descriptionValue);

      const monthlyRent = Number(
        obtenerValor(body, "renta") ??
        obtenerValor(body, "monthlyRent")
      );

      const address = obtenerTexto(
        obtenerValor(body, "ubicacion") ??
        obtenerValor(body, "address")
      );

      const latitude = Number(obtenerValor(body, "latitude"));
      const longitude = Number(obtenerValor(body, "longitude"));

      const availableFromValue = obtenerValor(body, "availableFrom");
      const availableFrom =
        availableFromValue === undefined || availableFromValue === ""
          ? null
          : obtenerTexto(availableFromValue);

      const maxRoommatesValue = obtenerValor(body, "maxRoommates");

      const maxRoommates =
        maxRoommatesValue === undefined || maxRoommatesValue === ""
          ? null
          : Number(maxRoommatesValue);

      if (!title || title.trim().length < 5 || title.trim().length > 200) {
        return c.json(
          { error: "El título debe tener entre 5 y 200 caracteres." },
          400
        );
      }

      if (descriptionValue !== undefined && description === undefined) {
        return c.json({ error: "La descripción no es válida." }, 400);
      }

      if (!Number.isFinite(monthlyRent) || monthlyRent <= 0) {
        return c.json(
          { error: "La renta mensual debe ser mayor a cero." },
          400
        );
      }

      if (!address?.trim() || address.trim().length > 500) {
        return c.json({ error: "La dirección no es válida." }, 400);
      }

      if (
        !Number.isFinite(latitude) ||
        latitude < -90 ||
        latitude > 90 ||
        !Number.isFinite(longitude) ||
        longitude < -180 ||
        longitude > 180
      ) {
        return c.json(
          { error: "Las coordenadas de ubicación no son válidas." },
          400
        );
      }

      if (
        maxRoommates !== null &&
        (!Number.isInteger(maxRoommates) || maxRoommates < 1)
      ) {
        return c.json(
          { error: "El número de compañeros debe ser mayor a cero." },
          400
        );
      }

      if (
        availableFromValue !== undefined &&
        availableFromValue !== "" &&
        (!availableFrom || !fechaValida(availableFrom))
      ) {
        return c.json(
          { error: "La fecha de disponibilidad no es válida." },
          400
        );
      }

      const files = obtenerArchivos(body, "photos");

      if (files.length > 10) {
        return c.json(
          { error: "No puedes enviar más de 10 fotografías." },
          400
        );
      }

      const photos: RoomPhotoInput[] = [];

      for (const file of files) {
        if (typeof file === "string" || !TIPOS_IMAGEN.includes(file.type)) {
          return c.json(
            { error: "Solo se permiten imágenes JPG, PNG o WEBP." },
            400
          );
        }

        if (file.size === 0 || file.size > TAMANO_MAXIMO) {
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

      const room = await this.roomsService.createListing({
        hostId,
        title: title.trim(),
        description: description?.trim() ?? null,
        monthlyRent,
        availableFrom: availableFrom ?? null,
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

  // Actualizar publicación existente
  update = async (c: AuthContext) => {
    try {
      const id = c.req.param("id");

      if (!id) {
        return c.json({ error: "El ID es obligatorio." }, 400);
      }

      const existing = await this.roomsService.getById(id);
      const principal = c.get("auth");

      if (
        existing.hostId !== principal.userId &&
        !principal.roles.includes("admin")
      ) {
        return c.json(
          {
            error: "No tienes permiso para editar esta publicación.",
            code: "FORBIDDEN",
          },
          403
        );
      }

      const body = await c.req.parseBody({ all: true });

      const title = obtenerTexto(
        obtenerValor(body, "titulo") ??
        obtenerValor(body, "title")
      );

      const descriptionValue =
        obtenerValor(body, "descripcion") ??
        obtenerValor(body, "description");

      const description = obtenerTexto(descriptionValue);

      const monthlyRent = Number(
        obtenerValor(body, "renta") ??
        obtenerValor(body, "monthlyRent")
      );

      const address = obtenerTexto(
        obtenerValor(body, "ubicacion") ??
        obtenerValor(body, "address")
      );

      const latitude = Number(obtenerValor(body, "latitude"));
      const longitude = Number(obtenerValor(body, "longitude"));

      const availableFromValue = obtenerValor(body, "availableFrom");
      const availableFrom =
        availableFromValue === undefined || availableFromValue === ""
          ? null
          : obtenerTexto(availableFromValue);

      const maxRoommatesValue = obtenerValor(body, "maxRoommates");

      const maxRoommates =
        maxRoommatesValue === undefined || maxRoommatesValue === ""
          ? null
          : Number(maxRoommatesValue);

      if (!title || title.trim().length < 5 || title.trim().length > 200) {
        return c.json(
          { error: "El título debe tener entre 5 y 200 caracteres." },
          400
        );
      }

      if (descriptionValue !== undefined && description === undefined) {
        return c.json({ error: "La descripción no es válida." }, 400);
      }

      if (!Number.isFinite(monthlyRent) || monthlyRent <= 0) {
        return c.json(
          { error: "La renta mensual debe ser mayor a cero." },
          400
        );
      }

      if (!address?.trim() || address.trim().length > 500) {
        return c.json({ error: "La dirección no es válida." }, 400);
      }

      if (
        !Number.isFinite(latitude) ||
        latitude < -90 ||
        latitude > 90 ||
        !Number.isFinite(longitude) ||
        longitude < -180 ||
        longitude > 180
      ) {
        return c.json(
          { error: "Las coordenadas de ubicación no son válidas." },
          400
        );
      }

      if (
        maxRoommates !== null &&
        (!Number.isInteger(maxRoommates) || maxRoommates < 1)
      ) {
        return c.json(
          { error: "El número de compañeros debe ser mayor a cero." },
          400
        );
      }

      if (
        availableFromValue !== undefined &&
        availableFromValue !== "" &&
        (!availableFrom || !fechaValida(availableFrom))
      ) {
        return c.json(
          { error: "La fecha de disponibilidad no es válida." },
          400
        );
      }

      // Leer y validar el orden de las fotografías.
      const photosOrderValue = obtenerValor(body, "photosOrder");

      if (typeof photosOrderValue !== "string") {
        return c.json(
          { error: "No se recibió el orden de las fotografías." },
          400
        );
      }

      let photosOrder: unknown;

      try {
        photosOrder = JSON.parse(photosOrderValue);
      } catch {
        return c.json(
          { error: "El orden de las fotografías no tiene un formato válido." },
          400
        );
      }

      if (!Array.isArray(photosOrder) || photosOrder.length > 10) {
        return c.json(
          { error: "La publicación debe tener como máximo 10 fotografías." },
          400
        );
      }

      // Procesar los archivos nuevos.
      const files = obtenerArchivos(body, "photos");
      const newPhotos: RoomPhotoInput[] = [];

      for (const file of files) {
        if (typeof file === "string" || !TIPOS_IMAGEN.includes(file.type)) {
          return c.json(
            { error: "Solo se permiten imágenes JPG, PNG o WEBP." },
            400
          );
        }

        if (file.size === 0 || file.size > TAMANO_MAXIMO) {
          return c.json(
            { error: "Cada fotografía debe pesar máximo 8 MB." },
            400
          );
        }

        newPhotos.push({
          fileName: file.name || `${randomUUID()}.jpg`,
          mimeType: file.type,
          imageData: Buffer.from(await file.arrayBuffer()),
        });
      }

      // Relacionar cada elemento del orden con una foto existente o nueva.
      const photos: RoomPhotoUpdateItem[] = [];
      const usedFileIndexes = new Set<number>();

      for (const rawItem of photosOrder as unknown[]) {
        if (!esObjeto(rawItem)) {
          return c.json(
            { error: "La información de una fotografía no es válida." },
            400
          );
        }

        const item = rawItem;

        if (
          item.type === "existing" &&
          typeof item.id === "string" &&
          item.id.trim().length > 0
        ) {
          photos.push({
            type: "existing",
            id: item.id,
          });

          continue;
        }

        if (
          item.type === "new" &&
          typeof item.fileIndex === "number" &&
          Number.isInteger(item.fileIndex) &&
          item.fileIndex >= 0 &&
          item.fileIndex < newPhotos.length
        ) {
          if (usedFileIndexes.has(item.fileIndex)) {
            return c.json(
              {
                error:
                  "Un archivo nuevo está repetido en el orden de fotografías.",
              },
              400
            );
          }

          const photo = newPhotos[item.fileIndex];

          if (!photo) {
            return c.json(
              { error: "No se encontró una fotografía nueva." },
              400
            );
          }

          usedFileIndexes.add(item.fileIndex);

          photos.push({
            type: "new",
            photo,
          });

          continue;
        }

        return c.json(
          { error: "La información de una fotografía no es válida." },
          400
        );
      }

      // Comprobar que todos los archivos nuevos fueron incluidos en el orden.
      if (usedFileIndexes.size !== newPhotos.length) {
        return c.json(
          {
            error:
              "No todas las fotografías nuevas están relacionadas con el orden enviado.",
          },
          400
        );
      }

      // No permitir publicaciones activas con menos de tres fotografías.
      if (photos.length < 3 && existing.status !== "draft") {
        return c.json(
          {
            error:
              "Una publicación activa debe conservar al menos 3 fotografías.",
          },
          400
        );
      }

      const room = await this.roomsService.updateListing(id, {
        title: title.trim(),
        description: description?.trim() ?? null,
        monthlyRent,
        availableFrom: availableFrom ?? null,
        maxRoommates,
        address: address.trim(),
        latitude,
        longitude,
        photos,
      });

      return c.json(
        {
          message: "Publicación actualizada correctamente.",
          room: RoomView.toDetail(room),
        },
        200
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Error al actualizar la publicación.";

      return c.json({ error: message }, 400);
    }
  };

  // Publicar habitación creada
  publish = async (c: AuthContext) => {
    try {
      const id = c.req.param("id");

      if (!id) {
        return c.json({ error: "El ID es obligatorio" }, 400);
      }

      const existing = await this.roomsService.getById(id);
      const principal = c.get("auth");

      if (
        existing.hostId !== principal.userId &&
        !principal.roles.includes("admin")
      ) {
        return c.json(
          {
            error: "Solo el anfitrión puede publicar esta habitación.",
            code: "FORBIDDEN",
          },
          403
        );
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
