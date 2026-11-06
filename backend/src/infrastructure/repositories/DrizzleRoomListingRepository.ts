
import { and, asc, count, eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { randomUUID } from "node:crypto";

import {
  RoomListing,
  type IRoomListingRepository,
  type RoomPhotoInput,
  type RoomPhotoRecord,
} from "../../domain/index.js";
import {
  roomListings,
  roomPhotos,
  type RoomListingRow,
  type NewRoomListing,
} from "../../db/schema/rooms.js";

import { geoLocations } from "../../db/schema/geo.js";


export class DrizzleRoomListingRepository
  implements IRoomListingRepository {
  constructor(private db: MySql2Database<any>) { }

  // Convertir registro de MySQL a entidad RoomListing
  private async mapToEntity(
    row: RoomListingRow
  ): Promise<RoomListing> {
    const photoTotal = await this.countPhotos(row.id);

    return new RoomListing({
      id: row.id,
      hostId: row.hostId,
      locationId: row.locationId,
      title: row.title,
      description: row.description,
      monthlyRent: Number(row.monthlyRent),
      status: row.status,
      photoCount: photoTotal,
      availableFrom: row.availableFrom
        ? new Date(`${row.availableFrom}T00:00:00`)
        : null,
      maxRoommates: row.maxRoommates,
      publishedAt: row.publishedAt
        ? new Date(row.publishedAt)
        : null,
      closedAt: row.closedAt
        ? new Date(row.closedAt)
        : null,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    });
  }

  // Buscar habitación por ID
  async findById(id: string): Promise<RoomListing | null> {
    const rows = await this.db
      .select()
      .from(roomListings)
      .where(eq(roomListings.id, id))
      .limit(1);

    const row = rows[0];

    if (!row) return null;

    return await this.mapToEntity(row);
  }
  // Recuperar la primera fotografía de una habitación.
async findFirstPhotoByListingId(
  listingId: string
): Promise<RoomPhotoRecord | null> {
  const rows = await this.db
    .select({
      id: roomPhotos.id,
      listingId: roomPhotos.listingId,
      fileName: roomPhotos.fileName,
      mimeType: roomPhotos.mimeType,
      imageData: roomPhotos.imageData,
      position: roomPhotos.position,
    })
    .from(roomPhotos)
    .where(eq(roomPhotos.listingId, listingId))
    .orderBy(asc(roomPhotos.position))
    .limit(1);

  const photo = rows[0];

  if (!photo) {
    return null;
  }

  return {
    id: photo.id,
    listingId: photo.listingId,
    fileName: photo.fileName,
    mimeType: photo.mimeType,
    imageData: photo.imageData,
    position: photo.position,
  };
}

  // Obtener habitaciones publicadas
  async findPublished(
    limit = 20,
    offset = 0
  ): Promise<RoomListing[]> {
    const rows = await this.db
      .select()
      .from(roomListings)
      .where(eq(roomListings.status, "published"))
      .limit(limit)
      .offset(offset);

    const results: RoomListing[] = [];

    for (const row of rows) {
      results.push(await this.mapToEntity(row));
    }

    return results;
  }

  // Obtener habitaciones de un anfitrión
  async findByHostId(hostId: string): Promise<RoomListing[]> {
    const rows = await this.db
      .select()
      .from(roomListings)
      .where(eq(roomListings.hostId, hostId));

    const results: RoomListing[] = [];

    for (const row of rows) {
      results.push(await this.mapToEntity(row));
    }

    return results;
  }

  // Crear habitación básica
  async create(room: RoomListing): Promise<RoomListing> {
    const newRecord: NewRoomListing = {
      id: room.id,
      hostId: room.hostId,
      locationId: room.locationId ?? null,
      title: room.title,
      description: room.description ?? null,
      monthlyRent: room.monthlyRent.toFixed(2),
      status: room.status,
      maxRoommates: room.maxRoommates ?? null,
      availableFrom: room.availableFrom ?? null,
    };

    await this.db.insert(roomListings).values(newRecord);

    return room;
  }

  // Crear habitación, ubicación y fotografías
  // dentro de una transacción
  async createWithLocationAndPhotos(
    room: RoomListing,
    location: {
      address: string;
      latitude: number;
      longitude: number;
    },
    photos: RoomPhotoInput[]
  ): Promise<RoomListing> {
    const locationId = randomUUID();

    await this.db.transaction(async (tx) => {
      // 1. Guardar ubicación
      await tx.insert(geoLocations).values({
        id: locationId,
        address: location.address,
        latitude: location.latitude.toFixed(6),
        longitude: location.longitude.toFixed(6),
      });

      // 2. Guardar habitación relacionada con su ubicación
      const newRecord: NewRoomListing = {
        id: room.id,
        hostId: room.hostId,
        locationId,
        title: room.title,
        description: room.description ?? null,
        monthlyRent: room.monthlyRent.toFixed(2),
        status: room.status,
        maxRoommates: room.maxRoommates ?? null,
        availableFrom: room.availableFrom ?? null,
      };

      await tx.insert(roomListings).values(newRecord);

      // 3. Guardar fotografías
      // 3. Guardar fotografías en MySQL como datos binarios
      if (photos.length > 0) {
        await tx.insert(roomPhotos).values(
          photos.map((photo, index) => ({
            id: randomUUID(),
            listingId: room.id,
            fileName: photo.fileName,
            mimeType: photo.mimeType,
            imageData: photo.imageData,
            position: index + 1,
          }))
        );
      }
    });

    // 4. Devolver habitación con su ubicación y fotografías
    return new RoomListing({
      id: room.id,
      hostId: room.hostId,
      locationId,
      title: room.title,
      description: room.description,
      monthlyRent: room.monthlyRent,
      availableFrom: room.availableFrom,
      maxRoommates: room.maxRoommates,
      status: room.status,
      photoCount: photos.length,
      createdAt: room.createdAt,
      updatedAt: new Date(),
    });
  }

  // Actualizar habitación
  async update(room: RoomListing): Promise<void> {
    await this.db
      .update(roomListings)
      .set({
        title: room.title,
        description: room.description ?? null,
        monthlyRent: room.monthlyRent.toFixed(2),
        status: room.status,
      })
      .where(eq(roomListings.id, room.id));
  }

  // Contar fotografías
  async countPhotos(listingId: string): Promise<number> {
    const result = await this.db
      .select({ value: count() })
      .from(roomPhotos)
      .where(eq(roomPhotos.listingId, listingId));

    return Number(result[0]?.value ?? 0);
  }


  // Recuperar fotografía desde MySQL
  async findPhotoById(
    listingId: string,
    photoId: string
  ): Promise<RoomPhotoRecord | null> {
    const rows = await this.db
      .select({
        id: roomPhotos.id,
        listingId: roomPhotos.listingId,
        fileName: roomPhotos.fileName,
        mimeType: roomPhotos.mimeType,
        imageData: roomPhotos.imageData,
        position: roomPhotos.position,
      })
      .from(roomPhotos)
      .where(
        and(
          eq(roomPhotos.listingId, listingId),
          eq(roomPhotos.id, photoId)
        )
      )
      .limit(1);

    const photo = rows[0];

    if (!photo) {
      return null;
    }

    return {
      id: photo.id,
      listingId: photo.listingId,
      fileName: photo.fileName,
      mimeType: photo.mimeType,
      imageData: photo.imageData,
      position: photo.position,
    };
  }

}
