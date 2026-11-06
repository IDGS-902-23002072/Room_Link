import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  MAX_PROFILE_PHOTO_SIZE_BYTES,
  PROFILE_PHOTO_MIME_TYPES,
  type IProfilePhotoStorage,
  type StoredPhotoFile,
} from "../../domain/index.js";

const EXTENSIONES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const UPLOADS_ROUTE = "/uploads";
export const PHOTOS_ROUTE = `${UPLOADS_ROUTE}/photos`;

/**
 * Guarda las fotos del perfil en el sistema de archivos local y expone una
 * URL relativa servida por la propia API.
 */
export class LocalProfilePhotoStorage implements IProfilePhotoStorage {
  constructor(
    private readonly destination = path.resolve(process.cwd(), "uploads", "photos"),
  ) {}

  async save(archivo: File): Promise<StoredPhotoFile> {
    const mimeType = archivo.type?.trim().toLowerCase() ?? "";
    const extension = EXTENSIONES[mimeType];
    if (!extension) {
      throw new Error("La foto debe ser JPG, PNG o WEBP.");
    }
    if (archivo.size > MAX_PROFILE_PHOTO_SIZE_BYTES) {
      throw new Error("Cada foto debe pesar como máximo 5 MB.");
    }
    if (archivo.size <= 0) {
      throw new Error("La foto está vacía o no se pudo leer.");
    }

    const nombreArchivo = `${randomUUID()}.${extension}`;
    const bytes = Buffer.from(await archivo.arrayBuffer());

    await mkdir(this.destination, { recursive: true });
    await writeFile(path.join(this.destination, nombreArchivo), bytes);

    return {
      url: `${PHOTOS_ROUTE}/${nombreArchivo}`,
      sizeBytes: bytes.byteLength,
      mimeType,
    };
  }

  async remove(url: string): Promise<void> {
    if (!url.startsWith(`${PHOTOS_ROUTE}/`)) return;

    const nombreArchivo = path.basename(url);
    if (!nombreArchivo || nombreArchivo === "." || nombreArchivo === "..") return;

    try {
      await unlink(path.join(this.destination, nombreArchivo));
    } catch (error) {
      const codigo = (error as NodeJS.ErrnoException).code;
      if (codigo !== "ENOENT") throw error;
    }
  }
}

export const esMimeTypeFotoPermitido = (mimeType: string): boolean =>
  (PROFILE_PHOTO_MIME_TYPES as readonly string[]).includes(mimeType);
