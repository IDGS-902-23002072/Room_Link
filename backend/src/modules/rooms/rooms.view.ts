
import type { ListingStatus, RoomFeedItem, RoomListing } from "../../domain/index.js";

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
  createdAt: string | null;
  updatedAt: string | null;
}

// ======================================================
// DTO DE DETALLE
// ======================================================

export interface RoomDetailDto extends RoomSummaryDto {
  description: string | null;
  locationId: string | null;
  maxRoommates: number | null;
}

export interface RoomFeedItemDto {
  id: string;
  hostId: string;
  hostName: string | null;
  title: string;
  description: string | null;
  monthlyRent: number;
  availableFrom: string | null;
  maxRoommates: number | null;
  photosCount: number;
  address: string | null;
  zone: string | null;
  city: string | null;
  publishedAt: string | null;
}

// ======================================================
// CONVERSIÓN SEGURA DE FECHAS
// ======================================================

function fechaIsoSegura(
  fecha: Date | null | undefined
): string | null {
  if (
    !(fecha instanceof Date) ||
    Number.isNaN(fecha.getTime())
  ) {
    return null;
  }

  return fecha.toISOString();
}

// ======================================================
// VISTA / SERIALIZADOR DE HABITACIONES
// ======================================================

export class RoomView {

  public static toSummary(
    room: RoomListing
  ): RoomSummaryDto {
    const availableFrom = fechaIsoSegura(room.availableFrom);

    return {
      id: room.id,
      hostId: room.hostId,
      title: room.title,
      monthlyRent: room.monthlyRent,
      status: room.status,
      photosCount: room.photoCount,

      availableFrom: availableFrom
        ? availableFrom.slice(0, 10)
        : null,

      publishedAt: fechaIsoSegura(room.publishedAt),
      closedAt: fechaIsoSegura(room.closedAt),
      createdAt: fechaIsoSegura(room.createdAt),
      updatedAt: fechaIsoSegura(room.updatedAt),
    };
  }

  public static toDetail(
    room: RoomListing
  ): RoomDetailDto {
    return {
      ...this.toSummary(room),
      description: room.description ?? null,
      locationId: room.locationId ?? null,
      maxRoommates: room.maxRoommates ?? null,
    };
  }

  public static toFeedItem(item: RoomFeedItem): RoomFeedItemDto {
    const availableFrom = fechaIsoSegura(item.availableFrom);
    return {
      id: item.id,
      hostId: item.hostId,
      hostName: item.hostName,
      title: item.title,
      description: item.description,
      monthlyRent: item.monthlyRent,
      availableFrom: availableFrom ? availableFrom.slice(0, 10) : null,
      maxRoommates: item.maxRoommates,
      photosCount: item.photoCount,
      address: item.address,
      zone: item.zone,
      city: item.city,
      publishedAt: fechaIsoSegura(item.publishedAt),
    };
  }

  public static toList(
    rooms: RoomListing[]
  ): RoomSummaryDto[] {
    return rooms.map((room) => this.toSummary(room));
  }
}
