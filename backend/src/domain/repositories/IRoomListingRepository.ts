
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

// Datos de una fotografía sin recuperar su archivo binario.
export interface RoomPhotoMetadata {
  id: string;
  listingId: string;
  fileName: string;
  mimeType: string;
  position: number;
}

export type RoomPhotoUpdateItem =
  | {
      type: "existing";
      id: string;
    }
  | {
      type: "new";
      photo: RoomPhotoInput;
    };

export interface RoomLocationInput {
  address: string;
  latitude: number;
  longitude: number;
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
    location: RoomLocationInput,
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

  // Recuperar los datos de ubicación de una habitación.
  findLocationById(
    id: string
  ): Promise<RoomLocationInput | null>;

  // Recuperar los metadatos de todas las fotografías.
  findPhotosByListingId(
    listingId: string
  ): Promise<RoomPhotoMetadata[]>;

  // Actualizar los datos, la ubicación y las fotografías.
  updateWithLocationAndPhotos(
    room: RoomListing,
    location: RoomLocationInput,
    photos: RoomPhotoUpdateItem[]
  ): Promise<void>;
}
