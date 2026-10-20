import type { RoomListing } from "../../domain/index.js";

export interface RoomSummaryDto {
  id: string;
  hostId: string;
  title: string;
  monthlyRent: number;
  status: string;
  photosCount: number;
  availableFrom: string | null;
  createdAt: string;
}

export interface RoomDetailDto extends RoomSummaryDto {
  description: string | null;
  locationId: string | null;
  maxRoommates: number | null;
}

/**
 * Vista / Serializador para el módulo de Habitaciones (Rooms).
 */
export class RoomView {
  public static toSummary(room: RoomListing): RoomSummaryDto {
    return {
      id: room.id,
      hostId: room.hostId,
      title: room.title,
      monthlyRent: room.monthlyRent,
      status: room.status,
      photosCount: room.photoCount,
      availableFrom: room.availableFrom?.toISOString().split("T")[0] ?? null,
      createdAt: room.createdAt.toISOString(),
    };
  }

  public static toDetail(room: RoomListing): RoomDetailDto {
    return {
      ...this.toSummary(room),
      description: room.description ?? null,
      locationId: room.locationId ?? null,
      maxRoommates: room.maxRoommates ?? null,
    };
  }

  public static toList(rooms: RoomListing[]): RoomSummaryDto[] {
    return rooms.map((r) => this.toSummary(r));
  }
}
