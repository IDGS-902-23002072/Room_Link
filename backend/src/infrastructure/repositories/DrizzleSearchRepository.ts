import { and, asc, desc, eq, gte, inArray, isNull, lte, like, ne, or, sql, type SQL } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  CompatibilityProfile,
  Profile,
  type SearchProfileDetails,
  RoomListing,
  type ISearchRepository,
  type SearchFilters,
  type Pagination,
} from "../../domain/index.js";
import {
  profileProfiles,
  profileHousingPreferences,
} from "../../db/schema/profile.js";
import { roomListings, roomPhotos, roomRules } from "../../db/schema/rooms.js";
import { geoLocations, geoZones } from "../../db/schema/geo.js";

import { authUsers } from "../../db/schema/auth.js";
import { compatProfiles, matchAffinityScores } from "../../db/schema/compatibility.js";
import { profilePhotos } from "../../db/schema/profile.js";

export class DrizzleSearchRepository implements ISearchRepository {
  constructor(private db: MySql2Database<any>) {}

  async searchProfiles(
    filters: SearchFilters,
    pagination: Pagination,
  ): Promise<{ items: Profile[]; total: number; details: Map<string, SearchProfileDetails> }> {
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
        city: geoZones.city,
        zone: geoZones.name,
        budgetMin: profileHousingPreferences.budgetMin,
        budgetMax: profileHousingPreferences.budgetMax,
        photoUrl: profilePhotos.url,
        score: matchAffinityScores.score,
        habits: compatProfiles,
      })
      .from(profileProfiles)
      .innerJoin(authUsers, eq(authUsers.id, profileProfiles.userId))
      .leftJoin(profileHousingPreferences, eq(profileProfiles.userId, profileHousingPreferences.userId))
      .leftJoin(geoZones, eq(geoZones.id, profileHousingPreferences.desiredZoneId))
      .leftJoin(compatProfiles, eq(compatProfiles.userId, profileProfiles.userId))
      .leftJoin(profilePhotos, and(eq(profilePhotos.userId, profileProfiles.userId), eq(profilePhotos.position, 1)))
      .leftJoin(matchAffinityScores, and(
        eq(matchAffinityScores.userA, filters.viewerId ?? ""),
        eq(matchAffinityScores.userB, profileProfiles.userId),
      ))
      .where(where)
      .orderBy(...this.profileOrder(filters), asc(profileProfiles.userId))
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

    const details = new Map(rows.map((row): [string, SearchProfileDetails] => [
      row.userId,
      {
        city: row.city,
        zone: row.zone,
        budgetMin: row.budgetMin,
        budgetMax: row.budgetMax,
        photoUrl: row.photoUrl,
        compatibilityScore: row.score === null ? null : Number(row.score),
        compatibilitySummary: row.habits ? new CompatibilityProfile(row.habits).calculateSummary() : null,
      },
    ]));
    return { items, total, details };
  }

  async listZones() {
    return this.db.selectDistinct({ id: geoZones.id, name: geoZones.name, city: geoZones.city })
      .from(geoZones).orderBy(geoZones.city, geoZones.name);
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
        photoCount: sql<number>`(SELECT COUNT(*) FROM ${roomPhotos} WHERE ${roomPhotos.listingId} = ${roomListings.id})`,
      })
      .from(roomListings)
      .leftJoin(roomRules, eq(roomListings.id, roomRules.listingId))
      .leftJoin(geoLocations, eq(roomListings.locationId, geoLocations.id))
      .where(where)
      .orderBy(desc(roomListings.publishedAt), asc(roomListings.id))
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
          photoCount: Number(row.photoCount),
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
      .innerJoin(authUsers, eq(authUsers.id, profileProfiles.userId))
      .leftJoin(profileHousingPreferences, eq(profileProfiles.userId, profileHousingPreferences.userId))
      .leftJoin(geoZones, eq(geoZones.id, profileHousingPreferences.desiredZoneId))
      .leftJoin(compatProfiles, eq(compatProfiles.userId, profileProfiles.userId))
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

  private profileOrder(filters: SearchFilters): SQL[] {
    if (filters.order === "name") return [asc(profileProfiles.fullName)];
    if (filters.order === "budget") {
      const budget = sql`COALESCE(${profileHousingPreferences.budgetMin}, ${profileHousingPreferences.budgetMax})`;
      return [sql`${budget} IS NULL`, asc(budget), asc(profileProfiles.fullName)];
    }
    const habitMatches = filters.habits?.map(({ dimension, score }) =>
      sql`CASE WHEN ${compatProfiles[dimension]} = ${score} THEN 1 ELSE 0 END`,
    ) ?? [];
    return [
      ...(habitMatches.length ? [desc(sql.join(habitMatches, sql` + `))] : []),
      desc(matchAffinityScores.score),
      asc(profileProfiles.fullName),
    ];
  }

  private buildProfileWhere(filters: SearchFilters): SQL | undefined {
    const parts: SQL[] = [eq(authUsers.status, "active")];
    if (filters.viewerId) parts.push(ne(profileProfiles.userId, filters.viewerId));
    if (filters.city) parts.push(eq(geoZones.city, filters.city));
    if (filters.zones?.length) parts.push(inArray(geoZones.name, filters.zones));
    for (const habit of filters.habits ?? []) {
      if (habit.required) parts.push(eq(compatProfiles[habit.dimension], habit.score));
    }

    if (filters.budgetMin != null) {
      parts.push(sql`COALESCE(${profileHousingPreferences.budgetMax}, ${profileHousingPreferences.budgetMin}) >= ${filters.budgetMin}`);
    }
    if (filters.budgetMax != null) {
      parts.push(sql`COALESCE(${profileHousingPreferences.budgetMin}, ${profileHousingPreferences.budgetMax}) <= ${filters.budgetMax}`);
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
      const text = `%${filters.text.replace(/[!%_]/g, "!$&")}%`;
      parts.push(sql`(${roomListings.title} LIKE ${text} ESCAPE '!' OR ${roomListings.description} LIKE ${text} ESCAPE '!')`);
    }
    if (filters.availableNow) {
      parts.push(or(isNull(roomListings.availableFrom), lte(roomListings.availableFrom, sql`CURDATE()`))!);
    }

    return and(...parts);
  }
}
