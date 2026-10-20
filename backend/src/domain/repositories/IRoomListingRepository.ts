import type { RoomListing } from "../entities/RoomListing.js";

export interface IRoomListingRepository {
  findById(id: string): Promise<RoomListing | null>;
  findPublished(limit?: number, offset?: number): Promise<RoomListing[]>;
  findByHostId(hostId: string): Promise<RoomListing[]>;
  create(room: RoomListing): Promise<RoomListing>;
  update(room: RoomListing): Promise<void>;
  countPhotos(listingId: string): Promise<number>;
}
