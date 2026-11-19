
import type { ListingStatus } from "./User.js";

// ======================================================
// PROPIEDADES DE LA PUBLICACIÓN
// ======================================================

export interface RoomListingProps {
  id: string;
  hostId: string;
  locationId?: string | null | undefined;
  title: string;
  description?: string | null | undefined;
  monthlyRent: number;
  availableFrom?: Date | null | undefined;
  maxRoommates?: number | null | undefined;
  status: ListingStatus;
  photoCount?: number | undefined;
  publishedAt?: Date | null | undefined;
  closedAt?: Date | null | undefined;
  createdAt: Date;
  updatedAt: Date;
}

// ======================================================
// ENTIDAD ROOM LISTING
// ======================================================

export class RoomListing {
  private props: RoomListingProps;

  private static readonly RENTA_MAXIMA = 99999999.99;
  private static readonly MAXIMO_COMPANEROS = 100;
  private static readonly MINIMO_FOTOGRAFIAS = 3;

  constructor(props: RoomListingProps) {
    this.validateRent(props.monthlyRent);
    this.validateTitle(props.title);
    this.validateMaxRoommates(props.maxRoommates ?? null);

    this.props = {
      ...props,
      photoCount: props.photoCount ?? 0,
    };
  }

  // ====================================================
  // GETTERS
  // ====================================================

  get id(): string {
    return this.props.id;
  }

  get hostId(): string {
    return this.props.hostId;
  }

  get locationId(): string | null | undefined {
    return this.props.locationId;
  }

  get title(): string {
    return this.props.title;
  }

  get description(): string | null | undefined {
    return this.props.description;
  }

  get publishedAt(): Date | null | undefined {
    return this.props.publishedAt;
  }

  get monthlyRent(): number {
    return this.props.monthlyRent;
  }

  get status(): ListingStatus {
    return this.props.status;
  }

  get photoCount(): number {
    return this.props.photoCount ?? 0;
  }

  get availableFrom(): Date | null | undefined {
    return this.props.availableFrom;
  }

  get maxRoommates(): number | null | undefined {
    return this.props.maxRoommates;
  }

  get publishedAt(): Date | null | undefined {
    return this.props.publishedAt;
  }

  get closedAt(): Date | null | undefined {
    return this.props.closedAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // ====================================================
  // FOTOGRAFÍAS
  // ====================================================

  public setPhotoCount(count: number): void {
    if (!Number.isInteger(count) || count < 0) {
      throw new Error("La cantidad de fotografías no es válida.");
    }

    this.props.photoCount = count;
    this.props.updatedAt = new Date();
  }

  public canPublish(): boolean {
    return this.photoCount >= RoomListing.MINIMO_FOTOGRAFIAS;
  }

  // ====================================================
  // ACTUALIZAR INFORMACIÓN
  // ====================================================

  public updateDetails(data: {
    title: string;
    description: string | null;
    monthlyRent: number;
    availableFrom: Date | null;
    maxRoommates: number | null;
  }): void {
    this.ensureNotClosed();

    this.validateTitle(data.title);
    this.validateRent(data.monthlyRent);
    this.validateMaxRoommates(data.maxRoommates);

    if (
      data.description !== null &&
      data.description.length > 5000
    ) {
      throw new Error(
        "La descripción no puede superar los 5000 caracteres.",
      );
    }

    this.props.title = data.title.trim();
    this.props.description = data.description?.trim() || null;
    this.props.monthlyRent = data.monthlyRent;
    this.props.availableFrom = data.availableFrom;
    this.props.maxRoommates = data.maxRoommates;
    this.props.updatedAt = new Date();
  }

  // ====================================================
  // PUBLICAR
  // ====================================================

  public publish(): void {
    if (this.props.status !== "draft") {
      throw new Error(
        "Solamente se pueden publicar habitaciones en estado borrador.",
      );
    }

    if (!this.canPublish()) {
      throw new Error(
        "Una habitación requiere al menos 3 fotografías para poder publicarse.",
      );
    }

    if (!this.props.locationId) {
      throw new Error(
        "No puedes publicar una habitación sin ubicación.",
      );
    }

    this.props.status = "published";
    this.props.publishedAt = new Date();
    this.props.updatedAt = new Date();
  }

  // ====================================================
  // PAUSAR
  // ====================================================

  public pause(): void {
    if (this.props.status !== "published") {
      throw new Error(
        "Solamente se pueden pausar publicaciones activas.",
      );
    }

    this.props.status = "paused";
    this.props.updatedAt = new Date();
  }

  // ====================================================
  // REACTIVAR
  // ====================================================

  public reactivate(): void {
    if (this.props.status !== "paused") {
      throw new Error(
        "Solamente se pueden reactivar publicaciones pausadas.",
      );
    }

    if (!this.canPublish()) {
      throw new Error(
        "Se necesitan al menos 3 fotografías para reactivar la publicación.",
      );
    }

    if (!this.props.locationId) {
      throw new Error(
        "No puedes reactivar una publicación sin ubicación.",
      );
    }

    this.props.status = "published";
    this.props.updatedAt = new Date();
  }

  // ====================================================
  // CERRAR
  // ====================================================

  public close(): void {
    if (this.props.status !== "published") {
      throw new Error(
        "Solamente se pueden cerrar publicaciones activas.",
      );
    }

    this.props.status = "closed";
    this.props.closedAt = new Date();
    this.props.updatedAt = new Date();
  }

  // ====================================================
  // CONVERTIR A JSON
  // ====================================================

  public toJSON(): Record<string, unknown> {
    return {
      id: this.props.id,
      hostId: this.props.hostId,
      locationId: this.props.locationId ?? null,
      title: this.props.title,
      description: this.props.description ?? null,
      monthlyRent: this.props.monthlyRent,
      status: this.props.status,
      photoCount: this.photoCount,
      availableFrom:
        this.props.availableFrom?.toISOString().split("T")[0] ?? null,
      maxRoommates: this.props.maxRoommates ?? null,
      publishedAt: this.props.publishedAt ?? null,
      closedAt: this.props.closedAt ?? null,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }

  // ====================================================
  // VALIDACIONES PRIVADAS
  // ====================================================

  private ensureNotClosed(): void {
    if (this.props.status === "closed") {
      throw new Error(
        "Una publicación cerrada no puede modificarse.",
      );
    }
  }

  private validateRent(rent: number): void {
    if (
      typeof rent !== "number" ||
      !Number.isFinite(rent) ||
      rent <= 0 ||
      rent > RoomListing.RENTA_MAXIMA ||
      Math.round(rent * 100) !== rent * 100
    ) {
      throw new Error(
        "La renta mensual debe ser positiva y tener máximo dos decimales.",
      );
    }
  }

  private validateTitle(title: string): void {
    if (
      typeof title !== "string" ||
      title.trim().length < 5 ||
      title.trim().length > 200
    ) {
      throw new Error(
        "El título debe tener entre 5 y 200 caracteres.",
      );
    }
  }

  private validateMaxRoommates(value: number | null): void {
    if (
      value !== null &&
      (
        !Number.isInteger(value) ||
        value < 1 ||
        value > RoomListing.MAXIMO_COMPANEROS
      )
    ) {
      throw new Error(
        "El número máximo de habitantes debe ser un entero entre 1 y 100.",
      );
    }
  }
}
