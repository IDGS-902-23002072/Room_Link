import { and, asc, eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  Profile,
  ProfilePhoto,
  ContactPrivacy,
  NotificationPreference,
  type NotificationType,
  type IProfileRepository,
} from "../../domain/index.js";
import {
  profileProfiles,
  profilePhotos,
  profileContactPrivacy,
  type ProfileRow,
  type NewProfile,
  type ProfilePhotoRow,
  type NewProfilePhoto,
} from "../../db/schema/profile.js";
import {
  notifPreferences,
  type NotifPreferenceRow,
} from "../../db/schema/governance.js";

export class DrizzleProfileRepository implements IProfileRepository {
  constructor(private db: MySql2Database<any>) {}

  async findByUserId(userId: string): Promise<Profile | null> {
    const rows: ProfileRow[] = await this.db
      .select()
      .from(profileProfiles)
      .where(eq(profileProfiles.userId, userId))
      .limit(1);

    const row = rows[0];
    if (!row) return null;
    return this.mapProfile(row);
  }

  async create(profile: Profile): Promise<Profile> {
    const newRecord: NewProfile = {
      userId: profile.userId,
      fullName: profile.fullName,
      birthDate: profile.birthDate,
      occupation: profile.occupation ?? null,
      bio: profile.bio ?? null,
      phone: profile.phone ?? null,
      instagram: profile.instagram ?? null,
      facebook: profile.facebook ?? null,
      identityStatus: profile.identityStatus,
    };

    await this.db.insert(profileProfiles).values(newRecord);
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

  async updateSocials(
    userId: string,
    socials: {
      instagram?: string | null | undefined;
      facebook?: string | null | undefined;
    },
  ): Promise<void> {
    const payload: Record<string, unknown> = {};
    if (socials.instagram !== undefined) payload["instagram"] = socials.instagram;
    if (socials.facebook !== undefined) payload["facebook"] = socials.facebook;
    if (Object.keys(payload).length === 0) return;

    await this.db
      .update(profileProfiles)
      .set(payload)
      .where(eq(profileProfiles.userId, userId));
  }

  async updateIdentityStatus(profile: Profile): Promise<void> {
    await this.db
      .update(profileProfiles)
      .set({
        identityStatus: profile.identityStatus,
        identityVerifiedAt: profile.identityVerifiedAt ?? null,
      })
      .where(eq(profileProfiles.userId, profile.userId));
  }

  async listPhotos(userId: string): Promise<ProfilePhoto[]> {
    const rows: ProfilePhotoRow[] = await this.db
      .select()
      .from(profilePhotos)
      .where(eq(profilePhotos.userId, userId))
      .orderBy(asc(profilePhotos.position));

    return rows.map((row) => this.mapPhoto(row));
  }

  async countPhotos(userId: string): Promise<number> {
    const rows = await this.db
      .select({ id: profilePhotos.id })
      .from(profilePhotos)
      .where(eq(profilePhotos.userId, userId));
    return rows.length;
  }

  async addPhoto(photo: ProfilePhoto): Promise<ProfilePhoto> {
    const record: NewProfilePhoto = {
      id: photo.id,
      userId: photo.userId,
      url: photo.url,
      position: photo.position,
    };
    await this.db.insert(profilePhotos).values(record);
    return photo;
  }

  async removePhoto(userId: string, photoId: string): Promise<void> {
    await this.db
      .delete(profilePhotos)
      .where(
        and(eq(profilePhotos.userId, userId), eq(profilePhotos.id, photoId)),
      );
  }

  async updatePhotoPosition(photo: ProfilePhoto): Promise<void> {
    await this.db
      .update(profilePhotos)
      .set({ position: photo.position })
      .where(
        and(
          eq(profilePhotos.userId, photo.userId),
          eq(profilePhotos.id, photo.id),
        ),
      );
  }

  async findPhoto(
    userId: string,
    photoId: string,
  ): Promise<ProfilePhoto | null> {
    const rows: ProfilePhotoRow[] = await this.db
      .select()
      .from(profilePhotos)
      .where(
        and(eq(profilePhotos.userId, userId), eq(profilePhotos.id, photoId)),
      )
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return this.mapPhoto(row);
  }

  async findContactPrivacy(userId: string): Promise<ContactPrivacy | null> {
    const rows = await this.db
      .select()
      .from(profileContactPrivacy)
      .where(eq(profileContactPrivacy.userId, userId))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return new ContactPrivacy({
      userId: row.userId,
      showPhoneToConnections: Boolean(row.showPhoneToConnections),
      showEmailToConnections: Boolean(row.showEmailToConnections),
      showSocialsToConnections: Boolean(row.showSocialsToConnections),
    });
  }

  async upsertContactPrivacy(privacy: ContactPrivacy): Promise<void> {
    await this.db
      .insert(profileContactPrivacy)
      .values({
        userId: privacy.userId,
        showPhoneToConnections: privacy.showPhoneToConnections,
        showEmailToConnections: privacy.showEmailToConnections,
        showSocialsToConnections: privacy.showSocialsToConnections,
      })
      .onDuplicateKeyUpdate({
        set: {
          showPhoneToConnections: privacy.showPhoneToConnections,
          showEmailToConnections: privacy.showEmailToConnections,
          showSocialsToConnections: privacy.showSocialsToConnections,
        },
      });
  }

  async listNotificationPreferences(
    userId: string,
  ): Promise<NotificationPreference[]> {
    const rows: NotifPreferenceRow[] = await this.db
      .select()
      .from(notifPreferences)
      .where(eq(notifPreferences.userId, userId));
    return rows.map(
      (row) =>
        new NotificationPreference({
          userId: row.userId,
          type: row.type,
          inApp: Boolean(row.inApp),
          email: Boolean(row.email),
        }),
    );
  }

  async upsertNotificationPreference(
    preference: NotificationPreference,
  ): Promise<void> {
    await this.db
      .insert(notifPreferences)
      .values({
        userId: preference.userId,
        type: preference.type,
        inApp: preference.inApp,
        email: preference.email,
      })
      .onDuplicateKeyUpdate({
        set: {
          inApp: preference.inApp,
          email: preference.email,
        },
      });
  }

  async findNotificationPreference(
    userId: string,
    type: NotificationType,
  ): Promise<NotificationPreference | null> {
    const rows: NotifPreferenceRow[] = await this.db
      .select()
      .from(notifPreferences)
      .where(
        and(
          eq(notifPreferences.userId, userId),
          eq(notifPreferences.type, type),
        ),
      )
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return new NotificationPreference({
      userId: row.userId,
      type: row.type,
      inApp: Boolean(row.inApp),
      email: Boolean(row.email),
    });
  }

  private mapProfile(row: ProfileRow): Profile {
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
      identityVerifiedAt: row.identityVerifiedAt
        ? new Date(row.identityVerifiedAt)
        : null,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    });
  }

  private mapPhoto(row: ProfilePhotoRow): ProfilePhoto {
    return new ProfilePhoto({
      id: row.id,
      userId: row.userId,
      url: row.url,
      position: row.position,
      createdAt: new Date(row.createdAt),
    });
  }
}
