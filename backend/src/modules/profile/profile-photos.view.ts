import type { ProfilePhoto } from "../../domain/index.js";

export interface ProfilePhotoResponseDto {
  id: string;
  url: string;
  position: number;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  isMain: boolean;
}

/**
 * Vista / Serializador para las fotos del perfil.
 */
export class ProfilePhotosView {
  public static toPublicPhoto(photo: ProfilePhoto): ProfilePhotoResponseDto {
    return {
      id: photo.id,
      url: photo.url,
      position: photo.position,
      mimeType: photo.mimeType,
      sizeBytes: photo.sizeBytes,
      createdAt: photo.createdAt.toISOString(),
      isMain: photo.isMain(),
    };
  }

  public static toPublicList(photos: ProfilePhoto[]): ProfilePhotoResponseDto[] {
    return photos.map((photo) => ProfilePhotosView.toPublicPhoto(photo));
  }
}
