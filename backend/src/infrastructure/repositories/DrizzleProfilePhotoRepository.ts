import { asc, eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  ProfilePhoto,
  type IProfilePhotoRepository,
} from "../../domain/index.js";
import {
  profilePhotos,
  type NewProfilePhoto,
  type ProfilePhotoRow,
} from "../../db/schema/profile.js";

const toDomain = (row: ProfilePhotoRow): ProfilePhoto =>
  new ProfilePhoto({
    id: row.id,
    userId: row.userId,
    url: row.url,
    position: row.position,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    createdAt: new Date(row.createdAt),
  });

export class DrizzleProfilePhotoRepository implements IProfilePhotoRepository {
  constructor(private db: MySql2Database<any>) {}

  async findByUserId(userId: string): Promise<ProfilePhoto[]> {
    const rows: ProfilePhotoRow[] = await this.db
      .select()
      .from(profilePhotos)
      .where(eq(profilePhotos.userId, userId))
      .orderBy(asc(profilePhotos.position));

    return rows.map(toDomain);
  }

  async findById(id: string): Promise<ProfilePhoto | null> {
    const rows: ProfilePhotoRow[] = await this.db
      .select()
      .from(profilePhotos)
      .where(eq(profilePhotos.id, id))
      .limit(1);

    const row = rows[0];
    return row ? toDomain(row) : null;
  }

  async countByUserId(userId: string): Promise<number> {
    const rows: ProfilePhotoRow[] = await this.db
      .select()
      .from(profilePhotos)
      .where(eq(profilePhotos.userId, userId));

    return rows.length;
  }

  async create(photo: ProfilePhoto): Promise<ProfilePhoto> {
    const record: NewProfilePhoto = {
      id: photo.id,
      userId: photo.userId,
      url: photo.url,
      position: photo.position,
      mimeType: photo.mimeType,
      sizeBytes: photo.sizeBytes,
      createdAt: photo.createdAt,
    };

    await this.db.insert(profilePhotos).values(record);
    return photo;
  }

  /**
   * La tabla tiene un índice único (user_id, position). Para reordenar sin
   * chocar con él se reemplaza el conjunto completo dentro de una transacción,
   * conservando los identificadores de cada foto.
   */
  async replaceAll(userId: string, photos: ProfilePhoto[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.delete(profilePhotos).where(eq(profilePhotos.userId, userId));

      if (photos.length === 0) return;

      const records: NewProfilePhoto[] = photos.map((photo) => ({
        id: photo.id,
        userId,
        url: photo.url,
        position: photo.position,
        mimeType: photo.mimeType,
        sizeBytes: photo.sizeBytes,
        createdAt: photo.createdAt,
      }));

      await tx.insert(profilePhotos).values(records);
    });
  }
}
