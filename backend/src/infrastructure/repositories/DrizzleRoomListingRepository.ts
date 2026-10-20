import { count, eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { RoomListing, type IRoomListingRepository } from "../../domain/index.js";
import { roomListings, roomPhotos } from "../../db/schema/rooms.js";

export class DrizzleRoomListingRepository implements IRoomListingRepository {
  constructor(private db: MySql2Database<any>) {}

  async findById(id: string): Promise<RoomListing | null> {
    const rows = await this.db
      .select()
      .from(roomListings)
      .where(eq(roomListings.id, id))
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    const photoTotal = await this.countPhotos(id);

    return new RoomListing({
      id: row.id,
      hostId: row.hostId,
      locationId: row.locationId,
      title: row.title,
      description: row.description,
      monthlyRent: Number(row.monthlyRent),
      status: row.status,
      photoCount: photoTotal,
      availableFrom: row.availableFrom ? new Date(row.availableFrom) : null,
      maxRoommates: row.maxRoommates,
      publishedAt: row.publishedAt ? new Date(row.publishedAt) : null,
      closedAt: row.closedAt ? new Date(row.closedAt) : null,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    });
  }

  async findPublished(limit = 20, offset = 0): Promise<RoomListing[]> {
    const rows = await this.db
      .select()
      .from(roomListings)
      .where(eq(roomListings.status, "published"))
      .limit(limit)
      .offset(offset);

    const results: RoomListing[] = [];
    for (const row of rows) {
      const photoTotal = await this.countPhotos(row.id);
      results.push(
        new RoomListing({
          id: row.id,
          hostId: row.hostId,
          locationId: row.locationId,
          title: row.title,
          description: row.description,
          monthlyRent: Number(row.monthlyRent),
          status: row.status,
          photoCount: photoTotal,
          availableFrom: row.availableFrom ? new Date(row.availableFrom) : null,
          maxRoommates: row.maxRoommates,
          publishedAt: row.publishedAt ? new Date(row.publishedAt) : null,
          closedAt: row.closedAt ? new Date(row.closedAt) : null,
          createdAt: new Date(row.createdAt),
          updatedAt: new Date(row.updatedAt),
        }),
      );
    }
    return results;
  }

  async findByHostId(hostId: string): Promise<RoomListing[]> {
    const rows = await this.db
      .select()
      .from(roomListings)
      .where(eq(roomListings.hostId, hostId));

    const results: RoomListing[] = [];
    for (const row of rows) {
      const photoTotal = await this.countPhotos(row.id);
      results.push(
        new RoomListing({
          id: row.id,
          hostId: row.hostId,
          locationId: row.locationId,
          title: row.title,
          description: row.description,
          monthlyRent: Number(row.monthlyRent),
          status: row.status,
          photoCount: photoTotal,
          availableFrom: row.availableFrom ? new Date(row.availableFrom) : null,
          maxRoommates: row.maxRoommates,
          publishedAt: row.publishedAt ? new Date(row.publishedAt) : null,
          closedAt: row.closedAt ? new Date(row.closedAt) : null,
          createdAt: new Date(row.createdAt),
          updatedAt: new Date(row.updatedAt),
        }),
      );
    }
    return results;
  }

  async create(room: RoomListing): Promise<RoomListing> {
    await this.db.insert(roomListings).values({
      id: room.id,
      hostId: room.hostId,
      locationId: room.locationId ?? null,
      title: room.title,
      description: room.description ?? null,
      monthlyRent: room.monthlyRent.toFixed(2),
      status: room.status,
      maxRoommates: room.maxRoommates ?? null,
      availableFrom: room.availableFrom ?? null,
    });
    return room;
  }

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

  async countPhotos(listingId: string): Promise<number> {
    const result = await this.db
      .select({ value: count() })
      .from(roomPhotos)
      .where(eq(roomPhotos.listingId, listingId));

    return Number(result[0]?.value ?? 0);
  }
}
