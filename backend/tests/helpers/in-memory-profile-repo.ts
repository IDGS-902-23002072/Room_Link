import {
  Profile,
  ProfilePhoto,
  ContactPrivacy,
  NotificationPreference,
  type NotificationType,
  type IProfileRepository,
} from "../../src/domain/index.js";

/**
 * Repositorio en memoria para pruebas unitarias de módulos de Perfil extendido
 * (HU-02). Mantiene estado observable en Maps públicos para aserciones.
 */
export class InMemoryExtendedProfileRepository implements IProfileRepository {
  public profiles: Map<string, Profile> = new Map();
  public photos: Map<string, ProfilePhoto> = new Map();
  public privacy: Map<string, ContactPrivacy> = new Map();
  public prefs: Map<string, NotificationPreference> = new Map();

  async findByUserId(userId: string): Promise<Profile | null> {
    return this.profiles.get(userId) ?? null;
  }

  async create(profile: Profile): Promise<Profile> {
    this.profiles.set(profile.userId, profile);
    return profile;
  }

  async update(profile: Profile): Promise<void> {
    this.profiles.set(profile.userId, profile);
  }

  async updateSocials(): Promise<void> {
    /* la entidad ya está en el mapa */
  }

  async updateIdentityStatus(profile: Profile): Promise<void> {
    this.profiles.set(profile.userId, profile);
  }

  async listPhotos(userId: string): Promise<ProfilePhoto[]> {
    return Array.from(this.photos.values())
      .filter((p) => p.userId === userId)
      .sort((a, b) => a.position - b.position);
  }

  async countPhotos(userId: string): Promise<number> {
    return (await this.listPhotos(userId)).length;
  }

  async addPhoto(photo: ProfilePhoto): Promise<ProfilePhoto> {
    this.photos.set(photo.id, photo);
    return photo;
  }

  async removePhoto(_userId: string, photoId: string): Promise<void> {
    this.photos.delete(photoId);
  }

  async updatePhotoPosition(photo: ProfilePhoto): Promise<void> {
    this.photos.set(photo.id, photo);
  }

  async findPhoto(
    userId: string,
    photoId: string,
  ): Promise<ProfilePhoto | null> {
    const p = this.photos.get(photoId);
    return p && p.userId === userId ? p : null;
  }

  async findContactPrivacy(userId: string): Promise<ContactPrivacy | null> {
    return this.privacy.get(userId) ?? null;
  }

  async upsertContactPrivacy(privacy: ContactPrivacy): Promise<void> {
    this.privacy.set(privacy.userId, privacy);
  }

  async listNotificationPreferences(
    userId: string,
  ): Promise<NotificationPreference[]> {
    return Array.from(this.prefs.values()).filter((p) => p.userId === userId);
  }

  async upsertNotificationPreference(
    preference: NotificationPreference,
  ): Promise<void> {
    this.prefs.set(`${preference.userId}:${preference.type}`, preference);
  }

  async findNotificationPreference(
    userId: string,
    type: NotificationType,
  ): Promise<NotificationPreference | null> {
    return this.prefs.get(`${userId}:${type}`) ?? null;
  }
}
