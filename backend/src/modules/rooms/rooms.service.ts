
import { randomUUID } from "node:crypto";

import {
  RoomListing,
  type IRoomListingRepository,
  type RoomPhotoInput,
  type RoomPhotoRecord,
} from "../../domain/index.js";

export interface CreateRoomInput {
  hostId: string;
  title: string;
  description?: string | null;
  monthlyRent: number;
  availableFrom?: string | null;
  maxRoommates?: number | null;

  // Ubicación seleccionada desde el mapa
  address: string;
  latitude: number;
  longitude: number;

  // Fotografías que se almacenarán directamente en MySQL
  photos: RoomPhotoInput[];
}

export class RoomsService {
  constructor(private roomRepo: IRoomListingRepository) { }

  // Obtener habitación por ID
  async getById(id: string): Promise<RoomListing> {
    const room = await this.roomRepo.findById(id);

    if (!room) {
      throw new Error(`Habitación con ID ${id} no encontrada.`);
    }

    return room;
  }


  // Obtener fotografía de una habitación
  async getPhoto(
    listingId: string,
    photoId: string
  ): Promise<RoomPhotoRecord> {
    const photo = await this.roomRepo.findPhotoById(
      listingId,
      photoId
    );

    if (!photo) {
      throw new Error("Fotografía no encontrada.");
    }

    return photo;
  }


  // Obtener habitaciones publicadas
  async listPublished(
    limit = 20,
    offset = 0
  ): Promise<RoomListing[]> {
    return await this.roomRepo.findPublished(limit, offset);
  }

  // Obtener habitaciones de un anfitrión
  async listByHost(hostId: string): Promise<RoomListing[]> {
    return await this.roomRepo.findByHostId(hostId);
  }

  // Crear habitación con ubicación y fotografías
  async createListing(input: CreateRoomInput): Promise<RoomListing> {
    // Validar usuario
    if (!input.hostId.trim()) {
      throw new Error("El usuario es obligatorio.");
    }

    // Validar título
    if (
      !input.title.trim() ||
      input.title.trim().length < 5 ||
      input.title.trim().length > 200
    ) {
      throw new Error("El título debe tener entre 5 y 200 caracteres.");
    }

    // Validar renta
    if (!Number.isFinite(input.monthlyRent) || input.monthlyRent <= 0) {
      throw new Error("La renta mensual debe ser mayor a cero.");
    }

    // Validar ubicación
    if (!input.address.trim() || input.address.length > 500) {
      throw new Error("La dirección es obligatoria y no debe superar los 500 caracteres.");
    }

    if (
      !Number.isFinite(input.latitude) ||
      input.latitude < -90 ||
      input.latitude > 90
    ) {
      throw new Error("La latitud no es válida.");
    }

    if (
      !Number.isFinite(input.longitude) ||
      input.longitude < -180 ||
      input.longitude > 180
    ) {
      throw new Error("La longitud no es válida.");
    }

    // Validar compañeros
    if (
      input.maxRoommates != null &&
      (!Number.isInteger(input.maxRoommates) || input.maxRoommates < 1)
    ) {
      throw new Error("El número de compañeros debe ser un entero mayor a cero.");
    }
    // Validar fotografías
    const tiposPermitidos = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (
      !Array.isArray(input.photos) ||
      input.photos.length > 10 ||
      !input.photos.every(
        (photo) =>
          typeof photo.fileName === "string" &&
          photo.fileName.trim().length > 0 &&
          typeof photo.mimeType === "string" &&
          tiposPermitidos.includes(photo.mimeType) &&
          Buffer.isBuffer(photo.imageData) &&
          photo.imageData.length > 0 &&
          photo.imageData.length <= 8 * 1024 * 1024
      )
    ) {
      throw new Error(
        "Las fotografías deben ser JPG, PNG o WEBP, con un máximo de 8 MB cada una y 10 fotografías."
      );
    }

    // Validar fecha de disponibilidad
    if (input.availableFrom) {
      const date = new Date(`${input.availableFrom}T00:00:00`);

      if (Number.isNaN(date.getTime())) {
        throw new Error("La fecha de disponibilidad no es válida.");
      }
    }

    // Crear entidad de habitación
    const room = new RoomListing({
      id: randomUUID(),
      hostId: input.hostId.trim(),
      title: input.title.trim(),
      description: input.description?.trim() || null,
      monthlyRent: input.monthlyRent,
      availableFrom: input.availableFrom
        ? new Date(`${input.availableFrom}T00:00:00`)
        : null,
      maxRoommates: input.maxRoommates ?? null,
      status: "draft",
      photoCount: input.photos.length,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Guardar habitación, ubicación y fotografías
    return await this.roomRepo.createWithLocationAndPhotos(
      room,
      {
        address: input.address.trim(),
        latitude: input.latitude,
        longitude: input.longitude,
      },
      input.photos
    );
  }

  // Publicar habitación
  async publishListing(id: string): Promise<RoomListing> {
    const room = await this.getById(id);

    // Consultar fotografías guardadas
    const photoCount = await this.roomRepo.countPhotos(id);

    room.setPhotoCount(photoCount);

    // El dominio exige al menos 3 fotografías
    room.publish();

    await this.roomRepo.update(room);

    return room;
  }
}
