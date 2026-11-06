export interface ProfilePhotoProps {
  id: string;
  userId: string;
  url: string;
  position: number;
  createdAt: Date;
}

export class ProfilePhoto {
  public static readonly MAX_PHOTOS_PER_USER = 6;
  public static readonly MIN_POSITION = 1;
  public static readonly MAX_POSITION = 6;

  private props: ProfilePhotoProps;

  constructor(props: ProfilePhotoProps) {
    ProfilePhoto.validateUrl(props.url);
    ProfilePhoto.validatePosition(props.position);
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

  get createdAt(): Date {
    return this.props.createdAt;
  }

  public moveTo(position: number): void {
    ProfilePhoto.validatePosition(position);
    this.props.position = position;
  }

  public toJSON(): Record<string, unknown> {
    return {
      id: this.props.id,
      userId: this.props.userId,
      url: this.props.url,
      position: this.props.position,
    };
  }

  public static validateUrl(url: string): void {
    if (!url || typeof url !== "string") {
      throw new Error("La URL de la foto es obligatoria.");
    }
    if (url.length > 2048) {
      throw new Error("La URL de la foto es demasiado larga.");
    }
    if (!/^https?:\/\//i.test(url)) {
      throw new Error("La URL de la foto debe iniciar con http:// o https://");
    }
  }

  public static validatePosition(position: number): void {
    if (!Number.isInteger(position)) {
      throw new Error("La posición de la foto debe ser un entero.");
    }
    if (
      position < ProfilePhoto.MIN_POSITION ||
      position > ProfilePhoto.MAX_POSITION
    ) {
      throw new Error(
        `La posición de la foto debe estar entre ${ProfilePhoto.MIN_POSITION} y ${ProfilePhoto.MAX_POSITION}.`,
      );
    }
  }
}
