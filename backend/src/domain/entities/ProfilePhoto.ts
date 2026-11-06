export const MAX_PROFILE_PHOTOS = 6;
export const MAX_PROFILE_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;

export const PROFILE_PHOTO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type ProfilePhotoMimeType = (typeof PROFILE_PHOTO_MIME_TYPES)[number];

export interface ProfilePhotoProps {
  id: string;
  userId: string;
  url: string;
  position: number;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
}

/**
 * Entidad de dominio para una foto del perfil.
 * La posición 1 es siempre la foto principal.
 */
export class ProfilePhoto {
  private props: ProfilePhotoProps;

  constructor(props: ProfilePhotoProps) {
    this.validateUrl(props.url);
    this.validatePosition(props.position);
    this.validateMimeType(props.mimeType);
    this.validateSize(props.sizeBytes);
    this.props = { ...props };
  }

  get id(): string {
    return this.props.id;
  }

  get userId(): string {
    return this.props.userId;
  }

  get url(): string {
    return this.props.url;
  }

  get position(): number {
    return this.props.position;
  }

  get mimeType(): string {
    return this.props.mimeType;
  }

  get sizeBytes(): number {
    return this.props.sizeBytes;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  public isMain(): boolean {
    return this.props.position === 1;
  }

  public moveTo(position: number): void {
    this.validatePosition(position);
    this.props.position = position;
  }

  private validateUrl(url: string): void {
    if (!url || !url.trim()) {
      throw new Error("La URL de la foto es obligatoria.");
    }
  }

  private validatePosition(position: number): void {
    if (!Number.isInteger(position) || position < 1 || position > MAX_PROFILE_PHOTOS) {
      throw new Error(
        `La posición de la foto debe ser un entero entre 1 y ${MAX_PROFILE_PHOTOS}.`,
      );
    }
  }

  private validateMimeType(mimeType: string): void {
    if (!(PROFILE_PHOTO_MIME_TYPES as readonly string[]).includes(mimeType)) {
      throw new Error("La foto debe ser JPG, PNG o WEBP.");
    }
  }

  private validateSize(sizeBytes: number): void {
    if (!Number.isFinite(sizeBytes) || sizeBytes < 0) {
      throw new Error("El tamaño de la foto es inválido.");
    }
    if (sizeBytes > MAX_PROFILE_PHOTO_SIZE_BYTES) {
      throw new Error("Cada foto debe pesar como máximo 5 MB.");
    }
  }
}
