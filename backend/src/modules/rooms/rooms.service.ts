import { randomUUID } from "node:crypto";
import { RoomListing, type IRoomListingRepository } from "../../domain/index.js";

export interface CreateRoomInput {
  hostId: string;
  title: string;
  description?: string | null | undefined;
  monthlyRent: number;
  availableFrom?: string | null | undefined;
  maxRoommates?: number | null | undefined;
}

export class RoomsService {
  constructor(private roomRepo: IRoomListingRepository) {}

  async getById(id: string): Promise<RoomListing> {
    const room = await this.roomRepo.findById(id);
    if (!room) {
      throw new Error(`Habitación con ID ${id} no encontrada.`);
    }
    return room;
  }

  async listPublished(limit = 20, offset = 0): Promise<RoomListing[]> {
    return await this.roomRepo.findPublished(limit, offset);
  }

  async listByHost(hostId: string): Promise<RoomListing[]> {
    return await this.roomRepo.findByHostId(hostId);
  }

  async createListing(input: CreateRoomInput): Promise<RoomListing> {
    const room = new RoomListing({
      id: randomUUID(),
      hostId: input.hostId,
      title: input.title,
      description: input.description ?? null,
      monthlyRent: input.monthlyRent,
      availableFrom: input.availableFrom ? new Date(input.availableFrom) : null,
      maxRoommates: input.maxRoommates ?? null,
      status: "draft",
      photoCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return await this.roomRepo.create(room);
  }

  async publishListing(id: string): Promise<RoomListing> {
    const room = await this.getById(id);
    const photoCount = await this.roomRepo.countPhotos(id);
    room.setPhotoCount(photoCount);

    // Ejecuta la regla de negocio del dominio: requiere al menos 3 fotos
    room.publish();
    await this.roomRepo.update(room);
    return room;
  }
}
