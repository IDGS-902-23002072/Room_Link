import { and, eq, gte, lte, like, sql, type SQL } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  Profile,
  RoomListing,
  type ISearchRepository,
  type SearchFilters,
  type Pagination,
} from "../../domain/index.js";
import {
  profileProfiles,
  profileHousingPreferences,
} from "../../db/schema/profile.js";
import { roomListings, roomRules } from "../../db/schema/rooms.js";
import { geoLocations } from "../../db/schema/geo.js";

export class DrizzleSearchRepository implements ISearchRepository {
  constructor(private db: MySql2Database<any>) {}

  async searchProfiles(
    filters: SearchFilters,
    pagination: Pagination,
  ): Promise<{ items: Profile[]; total: number }> {
    const where = this.buildProfileWhere(filters);
    const offset = (pagination.page - 1) * pagination.pageSize;

    const rows = await this.db
      .select({
        userId: profileProfiles.userId,
        fullName: profileProfiles.fullName,
        birthDate: profileProfiles.birthDate,
        occupation: profileProfiles.occupation,
        bio: profileProfiles.bio,
        phone: profileProfiles.phone,
        instagram: profileProfiles.instagram,
        facebook: profileProfiles.facebook,
        identityStatus: profileProfiles.identityStatus,
        identityVerifiedAt: profileProfiles.identityVerifiedAt,
        createdAt: profileProfiles.createdAt,
        updatedAt: profileProfiles.updatedAt,
      })
      .from(profileProfiles)
      .leftJoin(
        profileHousingPreferences,
        eq(profileProfiles.userId, profileHousingPreferences.userId),
      )
      .where(where)
      .limit(pagination.pageSize)
      .offset(offset);

    const total = await this.countProfiles(filters);

    const items = rows.map(
      (row) =>
        new Profile({
          userId: row.userId,
          fullName: row.fullName,
          birthDate: new Date(row.birthDate),
          occupation: row.occupation ?? null,
          bio: row.bio ?? null,
          phone: row.phone ?? null,
          instagram: row.instagram ?? null,
          facebook: row.facebook ?? null,
          identityStatus: row.identityStatus,
          identityVerifiedAt: row.identityVerifiedAt
            ? new Date(row.identityVerifiedAt)
            : null,
          createdAt: new Date(row.createdAt),
          updatedAt: new Date(row.updatedAt),
        }),
    );

    return { items, total };
  }

  async searchListings(
    filters: SearchFilters,
    pagination: Pagination,
  ): Promise<{ items: RoomListing[]; total: number }> {
    const where = this.buildListingWhere(filters);
    const offset = (pagination.page - 1) * pagination.pageSize;

    const rows = await this.db
      .select({
        id: roomListings.id,
        hostId: roomListings.hostId,
        locationId: roomListings.locationId,
        title: roomListings.title,
        description: roomListings.description,
        monthlyRent: roomListings.monthlyRent,
        availableFrom: roomListings.availableFrom,
        maxRoommates: roomListings.maxRoommates,
        status: roomListings.status,
        publishedAt: roomListings.publishedAt,
        closedAt: roomListings.closedAt,
        createdAt: roomListings.createdAt,
        updatedAt: roomListings.updatedAt,
      })
      .from(roomListings)
      .leftJoin(roomRules, eq(roomListings.id, roomRules.listingId))
      .leftJoin(geoLocations, eq(roomListings.locationId, geoLocations.id))
      .where(where)
      .limit(pagination.pageSize)
      .offset(offset);

    const total = await this.countListings(filters);

    const items = rows.map(
      (row) =>
        new RoomListing({
          id: row.id,
          hostId: row.hostId,
          locationId: row.locationId,
          title: row.title,
          description: row.description,
          monthlyRent: Number(row.monthlyRent),
          availableFrom: row.availableFrom ? new Date(row.availableFrom) : null,
          maxRoommates: row.maxRoommates,
          status: row.status,
          publishedAt: row.publishedAt ? new Date(row.publishedAt) : null,
          closedAt: row.closedAt ? new Date(row.closedAt) : null,
          createdAt: new Date(row.createdAt),
          updatedAt: new Date(row.updatedAt),
        }),
    );

    return { items, total };
  }

  async countProfiles(filters: SearchFilters): Promise<number> {
    const where = this.buildProfileWhere(filters);
    const rows = await this.db
      .select({ total: sql<number>`count(*)` })
      .from(profileProfiles)
      .leftJoin(
        profileHousingPreferences,
        eq(profileProfiles.userId, profileHousingPreferences.userId),
      )
      .where(where);
    return Number(rows[0]?.total ?? 0);
  }

  async countListings(filters: SearchFilters): Promise<number> {
    const where = this.buildListingWhere(filters);
    const rows = await this.db
      .select({ total: sql<number>`count(*)` })
      .from(roomListings)
      .leftJoin(roomRules, eq(roomListings.id, roomRules.listingId))
      .leftJoin(geoLocations, eq(roomListings.locationId, geoLocations.id))
      .where(where);
    return Number(rows[0]?.total ?? 0);
  }

  private buildProfileWhere(filters: SearchFilters): SQL | undefined {
    const parts: SQL[] = [];

    if (filters.budgetMin != null) {
      parts.push(gte(profileHousingPreferences.budgetMax, String(filters.budgetMin)));
    }
    if (filters.budgetMax != null) {
      parts.push(lte(profileHousingPreferences.budgetMin, String(filters.budgetMax)));
    }
    if (filters.zoneId) {
      parts.push(eq(profileHousingPreferences.desiredZoneId, filters.zoneId));
    }
    if (filters.minAge != null) {
      parts.push(
        sql`TIMESTAMPDIFF(YEAR, ${profileProfiles.birthDate}, CURDATE()) >= ${filters.minAge}`,
      );
    }
    if (filters.maxAge != null) {
      parts.push(
        sql`TIMESTAMPDIFF(YEAR, ${profileProfiles.birthDate}, CURDATE()) <= ${filters.maxAge}`,
      );
    }
    if (filters.text) {
      parts.push(like(profileProfiles.fullName, `%${filters.text}%`));
    }

    if (parts.length === 0) return undefined;
    return and(...parts);
  }

  private buildListingWhere(filters: SearchFilters): SQL | undefined {
    const parts: SQL[] = [eq(roomListings.status, "published")];

    if (filters.budgetMin != null) {
      parts.push(gte(roomListings.monthlyRent, String(filters.budgetMin)));
    }
    if (filters.budgetMax != null) {
      parts.push(lte(roomListings.monthlyRent, String(filters.budgetMax)));
    }
    if (filters.zoneId) {
      parts.push(eq(geoLocations.zoneId, filters.zoneId));
    }
    if (filters.petsAllowed != null) {
      parts.push(eq(roomRules.petsAllowed, filters.petsAllowed));
    }
    if (filters.smokingAllowed != null) {
      parts.push(eq(roomRules.smokingAllowed, filters.smokingAllowed));
    }
    if (filters.partiesAllowed != null) {
      parts.push(eq(roomRules.partiesAllowed, filters.partiesAllowed));
    }
    if (filters.text) {
      parts.push(like(roomListings.title, `%${filters.text}%`));
    }

    return and(...parts);
  }
}
