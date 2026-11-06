
import type { RoomListing } from "../entities/RoomListing.js";

export interface RoomPhotoInput {
  fileName: string;
  mimeType: string;
  imageData: Buffer;
}

export interface RoomPhotoRecord extends RoomPhotoInput {
  id: string;
  listingId: string;
  position: number;
}

export interface IRoomListingRepository {
  findById(id: string): Promise<RoomListing | null>;

  findPublished(
    limit?: number,
    offset?: number
  ): Promise<RoomListing[]>;

  findByHostId(hostId: string): Promise<RoomListing[]>;

  create(room: RoomListing): Promise<RoomListing>;

  createWithLocationAndPhotos(
    room: RoomListing,
    location: {
      address: string;
      latitude: number;
      longitude: number;
    },
    photos: RoomPhotoInput[]
  ): Promise<RoomListing>;

  update(room: RoomListing): Promise<void>;

  countPhotos(listingId: string): Promise<number>;

  // Recuperar una fotografía específica de una habitación.
  findPhotoById(
    listingId: string,
    photoId: string
  ): Promise<RoomPhotoRecord | null>;

  // Recuperar la primera fotografía de una habitación.
  findFirstPhotoByListingId(
    listingId: string
  ): Promise<RoomPhotoRecord | null>;
}
