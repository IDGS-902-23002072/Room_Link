
import { and, asc, count, desc, eq, gte, like, lte, ne, or, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { randomUUID } from "node:crypto";

import {
  RoomListing,
  type IRoomListingRepository,
  type RoomPhotoInput,
  type RoomPhotoRecord,
  type RoomPhotoMetadata,
  type RoomPhotoUpdateItem,
  type RoomLocationInput,
  type RoomFeedFilters,
  type RoomFeedItem,
} from "../../domain/index.js";

import {
  roomListings,
  roomPhotos,
  type RoomListingRow,
  type NewRoomListing,
} from "../../db/schema/rooms.js";

import { geoLocations, geoZones } from "../../db/schema/geo.js";
import { profileProfiles } from "../../db/schema/profile.js";

export class DrizzleRoomListingRepository
  implements IRoomListingRepository {

  constructor(private db: MySql2Database<any>) {}

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

  // Feed de habitaciones publicadas con ubicacion, zona y nombre del anfitrion
  async findPublishedFeed(
    filters: RoomFeedFilters,
    limit: number,
    offset: number
  ): Promise<RoomFeedItem[]> {
    const conditions = [eq(roomListings.status, "published")];

    if (filters.minRent !== undefined) {
      conditions.push(gte(roomListings.monthlyRent, String(filters.minRent)));
    }
    if (filters.maxRent !== undefined) {
      conditions.push(lte(roomListings.monthlyRent, String(filters.maxRent)));
    }
    if (filters.excludeHostId) {
      conditions.push(ne(roomListings.hostId, filters.excludeHostId));
    }
    if (filters.search) {
      const term = `%${filters.search.replace(/[\\%_]/g, "\\$&")}%`;
      const match = or(
        like(roomListings.title, term),
        like(roomListings.description, term),
        like(geoLocations.address, term),
        like(geoZones.name, term)
      );
      if (match) conditions.push(match);
    }

    const rows = await this.db
      .select({
        id: roomListings.id,
        hostId: roomListings.hostId,
        hostName: profileProfiles.fullName,
        title: roomListings.title,
        description: roomListings.description,
        monthlyRent: roomListings.monthlyRent,
        availableFrom: roomListings.availableFrom,
        maxRoommates: roomListings.maxRoommates,
        publishedAt: roomListings.publishedAt,
        address: geoLocations.address,
        zone: geoZones.name,
        city: geoZones.city,
        photoCount: sql<number>`(SELECT COUNT(*) FROM ${roomPhotos} WHERE ${roomPhotos.listingId} = ${roomListings.id})`,
      })
      .from(roomListings)
      .leftJoin(geoLocations, eq(geoLocations.id, roomListings.locationId))
      .leftJoin(geoZones, eq(geoZones.id, geoLocations.zoneId))
      .leftJoin(profileProfiles, eq(profileProfiles.userId, roomListings.hostId))
      .where(and(...conditions))
      .orderBy(desc(roomListings.publishedAt), desc(roomListings.createdAt))
      .limit(limit)
      .offset(offset);

    return rows.map((row) => ({
      id: row.id,
      hostId: row.hostId,
      hostName: row.hostName ?? null,
      title: row.title,
      description: row.description ?? null,
      monthlyRent: Number(row.monthlyRent),
      availableFrom: row.availableFrom
        ? new Date(`${row.availableFrom}T00:00:00`)
        : null,
      maxRoommates: row.maxRoommates ?? null,
      photoCount: Number(row.photoCount),
      address: row.address ?? null,
      zone: row.zone ?? null,
      city: row.city ?? null,
      publishedAt: row.publishedAt ? new Date(row.publishedAt) : null,
    }));
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
    location: RoomLocationInput,
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
        availableFrom: room.availableFrom ?? null,
        maxRoommates: room.maxRoommates ?? null,
      })
      .where(eq(roomListings.id, room.id));
  }

  // Recuperar ubicación de una habitación
  async findLocationById(
    id: string
  ): Promise<RoomLocationInput | null> {
    const rows = await this.db
      .select({
        address: geoLocations.address,
        latitude: geoLocations.latitude,
        longitude: geoLocations.longitude,
      })
      .from(geoLocations)
      .where(eq(geoLocations.id, id))
      .limit(1);

    const location = rows[0];

    if (!location) {
      return null;
    }

    return {
      address: location.address,
      latitude: Number(location.latitude),
      longitude: Number(location.longitude),
    };
  }

  // Recuperar metadatos de todas las fotografías
  // No recupera imageData para evitar cargar los archivos binarios.
  async findPhotosByListingId(
    listingId: string
  ): Promise<RoomPhotoMetadata[]> {
    const photos = await this.db
      .select({
        id: roomPhotos.id,
        listingId: roomPhotos.listingId,
        fileName: roomPhotos.fileName,
        mimeType: roomPhotos.mimeType,
        position: roomPhotos.position,
      })
      .from(roomPhotos)
      .where(eq(roomPhotos.listingId, listingId))
      .orderBy(asc(roomPhotos.position));

    return photos;
  }

  // Actualizar habitación, ubicación y fotografías
  // dentro de una transacción
  async updateWithLocationAndPhotos(
    room: RoomListing,
    location: RoomLocationInput,
    photos: RoomPhotoUpdateItem[]
  ): Promise<void> {

    if (!room.locationId) {
      throw new Error(
        "La habitación no tiene una ubicación asociada."
      );
    }

    if (photos.length > 10) {
      throw new Error(
        "No puedes registrar más de 10 fotografías."
      );
    }

    // Obtener los identificadores de las fotografías existentes
    const idsExistentes = photos
      .filter(
        (
          item
        ): item is Extract<
          RoomPhotoUpdateItem,
          { type: "existing" }
        > => item.type === "existing"
      )
      .map((item) => item.id);

    // Evitar identificadores repetidos
    if (new Set(idsExistentes).size !== idsExistentes.length) {
      throw new Error(
        "No puedes agregar dos veces la misma fotografía."
      );
    }

    await this.db.transaction(async (tx) => {

      // 1. Actualizar los datos de la habitación
      await tx
        .update(roomListings)
        .set({
          title: room.title,
          description: room.description ?? null,
          monthlyRent: room.monthlyRent.toFixed(2),
          availableFrom: room.availableFrom ?? null,
          maxRoommates: room.maxRoommates ?? null,
        })
        .where(eq(roomListings.id, room.id));

      // 2. Actualizar la ubicación existente
      await tx
        .update(geoLocations)
        .set({
          address: location.address,
          latitude: location.latitude.toFixed(6),
          longitude: location.longitude.toFixed(6),
        })
        .where(eq(geoLocations.id, room.locationId!));

      // 3. Consultar las fotografías que ya existen
      const fotosActuales = await tx
        .select({
          id: roomPhotos.id,
          position: roomPhotos.position,
        })
        .from(roomPhotos)
        .where(eq(roomPhotos.listingId, room.id));

      const idsActuales = new Set(
        fotosActuales.map((foto) => foto.id)
      );

      const idsSolicitados = new Set(idsExistentes);

      // 4. Comprobar que las fotografías enviadas
      // pertenecen a esta publicación
      for (const id of idsExistentes) {
        if (!idsActuales.has(id)) {
          throw new Error(
            "Una de las fotografías seleccionadas no pertenece a esta publicación."
          );
        }
      }

      // 5. Eliminar las fotografías que el usuario quitó
      for (const foto of fotosActuales) {
        if (!idsSolicitados.has(foto.id)) {
          await tx
            .delete(roomPhotos)
            .where(
              and(
                eq(roomPhotos.id, foto.id),
                eq(roomPhotos.listingId, room.id)
              )
            );
        }
      }

      // 6. Mover temporalmente las fotografías conservadas
      // Esto evita conflictos con el índice único de posiciones
      for (const foto of fotosActuales) {
        if (idsSolicitados.has(foto.id)) {
          await tx
            .update(roomPhotos)
            .set({
              position: foto.position + 100,
            })
            .where(eq(roomPhotos.id, foto.id));
        }
      }

      // 7. Asignar posiciones definitivas e insertar
      // fotografías nuevas respetando el orden recibido
      let position = 1;

      for (const item of photos) {

        // Fotografía que ya existe en MySQL
        if (item.type === "existing") {
          await tx
            .update(roomPhotos)
            .set({
              position,
            })
            .where(
              and(
                eq(roomPhotos.id, item.id),
                eq(roomPhotos.listingId, room.id)
              )
            );
        }

        // Fotografía nueva
        else if (item.type === "new") {
          await tx.insert(roomPhotos).values({
            id: randomUUID(),
            listingId: room.id,
            fileName: item.photo.fileName,
            mimeType: item.photo.mimeType,
            imageData: item.photo.imageData,
            position,
          });
        }

        position++;
      }
    });
  }

  // Contar fotografías
  async countPhotos(listingId: string): Promise<number> {
    const result = await this.db
      .select({
        value: count(),
      })
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
