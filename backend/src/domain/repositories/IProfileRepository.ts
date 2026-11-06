import type { Profile } from "../entities/Profile.js";
import type { ProfilePhoto } from "../entities/ProfilePhoto.js";
import type { ContactPrivacy } from "../entities/ContactPrivacy.js";
import type {
  NotificationPreference,
  NotificationType,
} from "../entities/NotificationPreference.js";

export interface IProfileRepository {
  findByUserId(userId: string): Promise<Profile | null>;
  create(profile: Profile): Promise<Profile>;
  update(profile: Profile): Promise<void>;
  updateSocials(
    userId: string,
    socials: {
      instagram?: string | null | undefined;
      facebook?: string | null | undefined;
    },
  ): Promise<void>;
  updateIdentityStatus(profile: Profile): Promise<void>;

  // Galería de fotos (EL-02.2 / EL-02.5)
  listPhotos(userId: string): Promise<ProfilePhoto[]>;
  countPhotos(userId: string): Promise<number>;
  addPhoto(photo: ProfilePhoto): Promise<ProfilePhoto>;
  removePhoto(userId: string, photoId: string): Promise<void>;
  updatePhotoPosition(photo: ProfilePhoto): Promise<void>;
  findPhoto(userId: string, photoId: string): Promise<ProfilePhoto | null>;

  // Privacidad de contacto
  findContactPrivacy(userId: string): Promise<ContactPrivacy | null>;
  upsertContactPrivacy(privacy: ContactPrivacy): Promise<void>;

  // Preferencias de notificaciones
  listNotificationPreferences(userId: string): Promise<NotificationPreference[]>;
  upsertNotificationPreference(preference: NotificationPreference): Promise<void>;
  findNotificationPreference(
    userId: string,
    type: NotificationType,
  ): Promise<NotificationPreference | null>;
}
