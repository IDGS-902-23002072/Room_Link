import { eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { Profile, type IProfileRepository } from "../../domain/index.js";
import { profileProfiles } from "../../db/schema/profile.js";

export class DrizzleProfileRepository implements IProfileRepository {
  constructor(private db: MySql2Database<any>) {}

  async findByUserId(userId: string): Promise<Profile | null> {
    const rows = await this.db
      .select()
      .from(profileProfiles)
      .where(eq(profileProfiles.userId, userId))
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    return new Profile({
      userId: row.userId,
      fullName: row.fullName,
      birthDate: new Date(row.birthDate),
      occupation: row.occupation ?? null,
      bio: row.bio ?? null,
      phone: row.phone ?? null,
      instagram: row.instagram ?? null,
      facebook: row.facebook ?? null,
      identityStatus: row.identityStatus,
      identityVerifiedAt: row.identityVerifiedAt ? new Date(row.identityVerifiedAt) : null,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    });
  }

  async create(profile: Profile): Promise<Profile> {
    await this.db.insert(profileProfiles).values({
      userId: profile.userId,
      fullName: profile.fullName,
      birthDate: profile.birthDate,
      occupation: profile.occupation ?? null,
      bio: profile.bio ?? null,
      phone: profile.phone ?? null,
      identityStatus: profile.identityStatus,
    });
    return profile;
  }

  async update(profile: Profile): Promise<void> {
    await this.db
      .update(profileProfiles)
      .set({
        fullName: profile.fullName,
        occupation: profile.occupation ?? null,
        bio: profile.bio ?? null,
        phone: profile.phone ?? null,
      })
      .where(eq(profileProfiles.userId, profile.userId));
  }
}
