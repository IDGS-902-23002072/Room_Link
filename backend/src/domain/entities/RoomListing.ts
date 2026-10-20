import type { ListingStatus } from "./User.js";

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

export class RoomListing {
  private props: RoomListingProps;

  constructor(props: RoomListingProps) {
    this.validateRent(props.monthlyRent);
    this.validateTitle(props.title);
    this.props = {
      ...props,
      photoCount: props.photoCount ?? 0,
    };
  }

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

  get createdAt(): Date {
    return this.props.createdAt;
  }

  public setPhotoCount(count: number): void {
    this.props.photoCount = Math.max(0, count);
  }

  public canPublish(): boolean {
    return (this.props.photoCount ?? 0) >= 3;
  }

  public publish(): void {
    if (!this.canPublish()) {
      throw new Error("Una habitación requiere al menos 3 fotografías para poder publicarse.");
    }
    this.props.status = "published";
    this.props.publishedAt = new Date();
    this.props.updatedAt = new Date();
  }

  public pause(): void {
    this.props.status = "paused";
    this.props.updatedAt = new Date();
  }

  public close(): void {
    this.props.status = "closed";
    this.props.closedAt = new Date();
    this.props.updatedAt = new Date();
  }

  public toJSON(): Record<string, unknown> {
    return {
      id: this.props.id,
      hostId: this.props.hostId,
      locationId: this.props.locationId,
      title: this.props.title,
      description: this.props.description,
      monthlyRent: this.props.monthlyRent,
      status: this.props.status,
      photoCount: this.props.photoCount,
      availableFrom: this.props.availableFrom?.toISOString().split("T")[0] ?? null,
      maxRoommates: this.props.maxRoommates,
      createdAt: this.props.createdAt,
    };
  }

  private validateRent(rent: number): void {
    if (rent <= 0) {
      throw new Error("La renta mensual debe ser un valor positivo mayor a 0.");
    }
  }

  private validateTitle(title: string): void {
    if (!title || title.trim().length < 5) {
      throw new Error("El título del cuarto debe tener al menos 5 caracteres.");
    }
  }
}
