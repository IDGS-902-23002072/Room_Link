import type { ProfilePhoto } from "../entities/ProfilePhoto.js";

export interface IProfilePhotoRepository {
  findByUserId(userId: string): Promise<ProfilePhoto[]>;
  findById(id: string): Promise<ProfilePhoto | null>;
  countByUserId(userId: string): Promise<number>;
  create(photo: ProfilePhoto): Promise<ProfilePhoto>;
  /**
   * Reemplaza el conjunto de fotos del usuario conservando sus identificadores.
   * Se usa para reordenar, elegir la foto principal y compactar posiciones.
   */
  replaceAll(userId: string, photos: ProfilePhoto[]): Promise<void>;
}
