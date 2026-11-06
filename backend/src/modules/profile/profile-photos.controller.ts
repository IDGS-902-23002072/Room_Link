import type { Context } from "hono";

import { MAX_PROFILE_PHOTO_SIZE_BYTES, MAX_PROFILE_PHOTOS } from "../../domain/index.js";
import type { ProfilePhotosService } from "./profile-photos.service.js";
import { ProfilePhotosView } from "./profile-photos.view.js";

const TAMANO_MAXIMO_PETICION = MAX_PROFILE_PHOTOS * MAX_PROFILE_PHOTO_SIZE_BYTES + 1024 * 1024;

function estadoParaError(mensaje: string): 400 | 404 | 409 | 413 {
  if (mensaje.startsWith("Perfil no encontrado") || mensaje.startsWith("La foto no existe")) {
    return 404;
  }
  if (mensaje.includes("Máximo 6 fotos") || mensaje.startsWith("Solo puedes agregar")) {
    return 409;
  }
  return 400;
}

export class ProfilePhotosController {
  constructor(private photosService: ProfilePhotosService) {}

  listPhotos = async (c: Context) => {
    try {
      const userId = c.req.param("userId");
      if (!userId) {
        return c.json({ error: "userId es obligatorio" }, 400);
      }

      const fotos = await this.photosService.listPhotos(userId);
      return c.json({ photos: ProfilePhotosView.toPublicList(fotos) }, 200);
    } catch (err: any) {
      const mensaje = err?.message ?? "No pudimos cargar las fotos.";
      return c.json({ error: mensaje }, estadoParaError(mensaje));
    }
  };

  uploadPhotos = async (c: Context) => {
    try {
      const userId = c.req.param("userId");
      if (!userId) {
        return c.json({ error: "userId es obligatorio" }, 400);
      }

      const tamanoDeclarado = Number(c.req.header("content-length") ?? 0);
      if (Number.isFinite(tamanoDeclarado) && tamanoDeclarado > TAMANO_MAXIMO_PETICION) {
        return c.json({ error: "La carga supera el tamaño permitido." }, 413);
      }

      const body = (await c.req.parseBody({ all: true })) as Record<string, unknown>;
      const archivos = this.extraerArchivos(body);

      if (!archivos.length) {
        return c.json(
          { error: "Adjunta al menos una foto en el campo 'photos'." },
          400,
        );
      }

      const fotos = await this.photosService.addPhotos(userId, archivos);
      return c.json({ photos: ProfilePhotosView.toPublicList(fotos) }, 201);
    } catch (err: any) {
      const mensaje = err?.message ?? "No pudimos subir las fotos.";
      return c.json({ error: mensaje }, estadoParaError(mensaje));
    }
  };

  reorderPhotos = async (c: Context) => {
    try {
      const userId = c.req.param("userId");
      if (!userId) {
        return c.json({ error: "userId es obligatorio" }, 400);
      }

      const body = (await c.req.json().catch(() => null)) as
        | { photoIds?: unknown }
        | null;
      const photoIds = body?.photoIds;
      if (!Array.isArray(photoIds) || photoIds.some((id) => typeof id !== "string")) {
        return c.json(
          { error: "photoIds debe ser un arreglo con los identificadores de tus fotos." },
          400,
        );
      }

      const fotos = await this.photosService.reorder(userId, photoIds as string[]);
      return c.json({ photos: ProfilePhotosView.toPublicList(fotos) }, 200);
    } catch (err: any) {
      const mensaje = err?.message ?? "No pudimos reordenar las fotos.";
      return c.json({ error: mensaje }, estadoParaError(mensaje));
    }
  };

  deletePhoto = async (c: Context) => {
    try {
      const userId = c.req.param("userId");
      const photoId = c.req.param("photoId");
      if (!userId || !photoId) {
        return c.json({ error: "userId y photoId son obligatorios" }, 400);
      }

      const fotos = await this.photosService.removePhoto(userId, photoId);
      return c.json({ photos: ProfilePhotosView.toPublicList(fotos) }, 200);
    } catch (err: any) {
      const mensaje = err?.message ?? "No pudimos eliminar la foto.";
      return c.json({ error: mensaje }, estadoParaError(mensaje));
    }
  };

  private extraerArchivos(body: Record<string, unknown>): File[] {
    const valores = [body["photos"], body["photo"]].flatMap((valor) =>
      Array.isArray(valor) ? valor : valor === undefined || valor === null ? [] : [valor],
    );

    return valores.filter((valor): valor is File => valor instanceof File);
  }
}
