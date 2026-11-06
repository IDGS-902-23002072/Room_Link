import { randomUUID } from "node:crypto";

import {
  MAX_PROFILE_PHOTOS,
  MAX_PROFILE_PHOTO_SIZE_BYTES,
  PROFILE_PHOTO_MIME_TYPES,
  ProfilePhoto,
  type IProfilePhotoRepository,
  type IProfilePhotoStorage,
  type IProfileRepository,
} from "../../domain/index.js";

/**
 * Servicio de aplicación para las fotos del perfil.
 *
 * Reglas de negocio:
 * - Como máximo 6 fotos por usuario.
 * - Solo se aceptan JPG, PNG y WEBP de hasta 5 MB.
 * - La foto en posición 1 es la principal.
 */
export class ProfilePhotosService {
  constructor(
    private photoRepo: IProfilePhotoRepository,
    private profileRepo: IProfileRepository,
    private storage: IProfilePhotoStorage,
  ) {}

  async listPhotos(userId: string): Promise<ProfilePhoto[]> {
    await this.assertProfileExists(userId);
    return this.photoRepo.findByUserId(userId);
  }

  async addPhotos(userId: string, archivos: File[]): Promise<ProfilePhoto[]> {
    await this.assertProfileExists(userId);

    if (!archivos.length) {
      throw new Error("Selecciona al menos una foto.");
    }

    const existentes = await this.photoRepo.findByUserId(userId);
    const disponibles = MAX_PROFILE_PHOTOS - existentes.length;
    if (disponibles <= 0) {
      throw new Error("Máximo 6 fotos.");
    }
    if (archivos.length > disponibles) {
      throw new Error(
        `Solo puedes agregar ${disponibles} foto${disponibles === 1 ? "" : "s"} más. Máximo 6 fotos.`,
      );
    }

    this.validarArchivos(archivos);

    const guardadas: ProfilePhoto[] = [];
    const urlsGuardadas: string[] = [];

    try {
      for (const [indice, archivo] of archivos.entries()) {
        const almacenada = await this.storage.save(archivo);
        urlsGuardadas.push(almacenada.url);

        const foto = new ProfilePhoto({
          id: randomUUID(),
          userId,
          url: almacenada.url,
          position: existentes.length + indice + 1,
          mimeType: almacenada.mimeType,
          sizeBytes: almacenada.sizeBytes,
          createdAt: new Date(),
        });

        guardadas.push(await this.photoRepo.create(foto));
      }
    } catch (error) {
      await this.revertir(userId, existentes, urlsGuardadas);
      throw error;
    }

    return this.photoRepo.findByUserId(userId);
  }

  async reorder(userId: string, photoIds: string[]): Promise<ProfilePhoto[]> {
    await this.assertProfileExists(userId);

    const existentes = await this.photoRepo.findByUserId(userId);
    if (existentes.length === 0) {
      throw new Error("Todavía no tienes fotos para ordenar.");
    }

    if (!Array.isArray(photoIds) || photoIds.length !== existentes.length) {
      throw new Error("El orden debe incluir todas tus fotos.");
    }

    const idsUnicos = new Set(photoIds);
    if (idsUnicos.size !== photoIds.length) {
      throw new Error("El orden contiene fotos repetidas.");
    }

    const porId = new Map(existentes.map((foto) => [foto.id, foto]));
    for (const id of photoIds) {
      if (!porId.has(id)) {
        throw new Error("El orden incluye una foto que no te pertenece.");
      }
    }

    const reordenadas = photoIds.map((id, indice) => {
      const foto = porId.get(id)!;
      foto.moveTo(indice + 1);
      return foto;
    });

    await this.photoRepo.replaceAll(userId, reordenadas);
    return reordenadas;
  }

  async removePhoto(userId: string, photoId: string): Promise<ProfilePhoto[]> {
    await this.assertProfileExists(userId);

    const existentes = await this.photoRepo.findByUserId(userId);
    const foto = existentes.find((item) => item.id === photoId);
    if (!foto) {
      throw new Error("La foto no existe o no pertenece a tu perfil.");
    }

    const restantes = existentes
      .filter((item) => item.id !== photoId)
      .map((item, indice) => {
        item.moveTo(indice + 1);
        return item;
      });

    await this.photoRepo.replaceAll(userId, restantes);

    try {
      await this.storage.remove(foto.url);
    } catch {
      // El archivo huérfano no debe impedir que la foto desaparezca del perfil.
    }

    return restantes;
  }

  private async assertProfileExists(userId: string): Promise<void> {
    if (!userId || !userId.trim()) {
      throw new Error("userId es obligatorio");
    }

    const perfil = await this.profileRepo.findByUserId(userId);
    if (!perfil) {
      throw new Error(
        `Perfil no encontrado para el usuario ${userId}. Crea tu perfil antes de agregar fotos.`,
      );
    }
  }

  private validarArchivos(archivos: File[]): void {
    for (const archivo of archivos) {
      const mimeType = archivo.type?.trim().toLowerCase() ?? "";
      if (!(PROFILE_PHOTO_MIME_TYPES as readonly string[]).includes(mimeType)) {
        throw new Error("La foto debe ser JPG, PNG o WEBP.");
      }
      if (archivo.size > MAX_PROFILE_PHOTO_SIZE_BYTES) {
        throw new Error("Cada foto debe pesar como máximo 5 MB.");
      }
      if (archivo.size <= 0) {
        throw new Error("La foto está vacía o no se pudo leer.");
      }
    }
  }

  private async revertir(
    userId: string,
    existentes: ProfilePhoto[],
    urlsGuardadas: string[],
  ): Promise<void> {
    try {
      await this.photoRepo.replaceAll(userId, existentes);
    } catch {
      // Si la base falla, al menos intentamos limpiar los archivos guardados.
    }

    for (const url of urlsGuardadas) {
      try {
        await this.storage.remove(url);
      } catch {
        // Limpieza best-effort.
      }
    }
  }
}
