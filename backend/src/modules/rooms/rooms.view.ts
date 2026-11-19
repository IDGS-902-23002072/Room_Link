
import type { ListingStatus, RoomListing } from "../../domain/index.js";

// ======================================================
// DTO DE RESUMEN
// ======================================================

export interface RoomSummaryDto {
  id: string;
  hostId: string;
  title: string;
  monthlyRent: number;
  status: ListingStatus;
  photosCount: number;
  availableFrom: string | null;
  publishedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ======================================================
// DTO DE DETALLE
// ======================================================

export interface RoomDetailDto extends RoomSummaryDto {
  description: string | null;
  locationId: string | null;
  maxRoommates: number | null;
}

// ======================================================
// VISTA / SERIALIZADOR DE HABITACIONES
// ======================================================

export class RoomView {

  // ====================================================
  // CONVERTIR A RESUMEN
  // ====================================================

  public static toSummary(
    room: RoomListing,
  ): RoomSummaryDto {
    return {
      id: room.id,
      hostId: room.hostId,
      title: room.title,
      monthlyRent: room.monthlyRent,
      status: room.status,
      photosCount: room.photoCount,

      availableFrom:
        room.availableFrom?.toISOString().split("T")[0] ?? null,

      publishedAt:
        room.publishedAt?.toISOString() ?? null,

      closedAt:
        room.closedAt?.toISOString() ?? null,

      createdAt: room.createdAt.toISOString(),
      updatedAt: room.updatedAt.toISOString(),
    };
  }

  // ====================================================
  // CONVERTIR A DETALLE
  // ====================================================

  public static toDetail(
    room: RoomListing,
  ): RoomDetailDto {
    return {
      ...this.toSummary(room),

      description: room.description ?? null,
      locationId: room.locationId ?? null,
      maxRoommates: room.maxRoommates ?? null,
    };
  }

  // ====================================================
  // CONVERTIR LISTA DE HABITACIONES
  // ====================================================

  public static toList(
    rooms: RoomListing[],
  ): RoomSummaryDto[] {
    return rooms.map((room) => this.toSummary(room));
  }
}
