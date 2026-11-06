import { randomUUID } from "node:crypto";
import {
  Profile,
  ProfilePhoto,
  ContactPrivacy,
  NotificationPreference,
  type NotificationType,
  type IProfileRepository,
} from "../../domain/index.js";

export interface CreateProfileInput {
  userId: string;
  fullName: string;
  birthDate: string; // YYYY-MM-DD
  occupation?: string | null | undefined;
  bio?: string | null | undefined;
  phone?: string | null | undefined;
  instagram?: string | null | undefined;
  facebook?: string | null | undefined;
}

export interface AddPhotoInput {
  url: string;
  position?: number;
}

export interface ReorderPhotoInput {
  photoId: string;
  position: number;
}

export class ProfileService {
  constructor(private profileRepo: IProfileRepository) {}

  async getProfile(userId: string): Promise<Profile> {
    const profile = await this.profileRepo.findByUserId(userId);
    if (!profile) {
      throw new Error(`Perfil no encontrado para el usuario ${userId}`);
    }
    return profile;
  }

  async createProfile(input: CreateProfileInput): Promise<Profile> {
    const existing = await this.profileRepo.findByUserId(input.userId);
    if (existing) {
      throw new Error("El usuario ya cuenta con un perfil registrado.");
    }

    const birthDateObj = new Date(input.birthDate);
    if (isNaN(birthDateObj.getTime())) {
      throw new Error("Fecha de nacimiento inválida. Formato esperado: AAAA-MM-DD");
    }

    // EL-02.4: validaciones de dominio (nombre, bio, ocupación, teléfono, socials)
    Profile.validateFullName(input.fullName);
    Profile.validateBio(input.bio ?? null);
    Profile.validateOccupation(input.occupation ?? null);
    Profile.validatePhone(input.phone ?? null);
    Profile.validateSocialHandle(input.instagram ?? null, "instagram");
    Profile.validateSocialHandle(input.facebook ?? null, "facebook");

    const profile = new Profile({
      userId: input.userId,
      fullName: input.fullName,
      birthDate: birthDateObj,
      occupation: input.occupation ?? null,
      bio: input.bio ?? null,
      phone: input.phone ?? null,
      instagram: input.instagram ?? null,
      facebook: input.facebook ?? null,
      identityStatus: "unverified",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return await this.profileRepo.create(profile);
  }

  /** EL-02.6: guardarPerfil(datos) — aplica reglas, persiste y devuelve el perfil. */
  async updateProfile(
    userId: string,
    updates: {
      fullName?: string | undefined;
      bio?: string | null | undefined;
      occupation?: string | null | undefined;
      phone?: string | null | undefined;
    },
  ): Promise<Profile> {
    const profile = await this.getProfile(userId);
    profile.updateDetails(updates);
    await this.profileRepo.update(profile);
    return profile;
  }

  async updateSocials(
    userId: string,
    socials: {
      instagram?: string | null | undefined;
      facebook?: string | null | undefined;
    },
  ): Promise<Profile> {
    const profile = await this.getProfile(userId);
    profile.updateSocials(socials);
    await this.profileRepo.updateSocials(userId, {
      instagram: profile.instagram ?? null,
      facebook: profile.facebook ?? null,
    });
    return profile;
  }

  // ---- Galería de fotos (EL-02.2 / EL-02.5) ----

  async listPhotos(userId: string): Promise<ProfilePhoto[]> {
    return this.profileRepo.listPhotos(userId);
  }

  async addPhoto(userId: string, input: AddPhotoInput): Promise<ProfilePhoto> {
    const existing = await this.profileRepo.listPhotos(userId);
    if (existing.length >= ProfilePhoto.MAX_PHOTOS_PER_USER) {
      throw new Error(
        `Sólo se permiten hasta ${ProfilePhoto.MAX_PHOTOS_PER_USER} fotos por perfil.`,
      );
    }

    const takenPositions = new Set(existing.map((p) => p.position));
    const requestedPosition = input.position ?? this.nextAvailablePosition(existing);
    if (input.position !== undefined && takenPositions.has(requestedPosition)) {
      throw new Error(
        `La posición ${requestedPosition} ya está ocupada por otra foto.`,
      );
    }

    const photo = new ProfilePhoto({
      id: randomUUID(),
      userId,
      url: input.url,
      position: requestedPosition,
      createdAt: new Date(),
    });
    return await this.profileRepo.addPhoto(photo);
  }

  async removePhoto(userId: string, photoId: string): Promise<void> {
    const photo = await this.profileRepo.findPhoto(userId, photoId);
    if (!photo) {
      throw new Error("Foto no encontrada para este usuario.");
    }
    await this.profileRepo.removePhoto(userId, photoId);
  }

  async reorderPhotos(
    userId: string,
    newOrder: ReorderPhotoInput[],
  ): Promise<ProfilePhoto[]> {
    if (!Array.isArray(newOrder) || newOrder.length === 0) {
      throw new Error("Debe proveerse al menos una foto a reordenar.");
    }
    const positions = newOrder.map((o) => o.position);
    const unique = new Set(positions);
    if (unique.size !== positions.length) {
      throw new Error("Hay posiciones duplicadas en la nueva ordenación.");
    }
    const current = await this.profileRepo.listPhotos(userId);
    const currentIds = new Set(current.map((p) => p.id));
    for (const entry of newOrder) {
      if (!currentIds.has(entry.photoId)) {
        throw new Error(
          `La foto ${entry.photoId} no pertenece al usuario ${userId}.`,
        );
      }
      ProfilePhoto.validatePosition(entry.position);
    }

    for (const entry of newOrder) {
      const photo = current.find((p) => p.id === entry.photoId)!;
      photo.moveTo(entry.position);
      await this.profileRepo.updatePhotoPosition(photo);
    }
    return await this.profileRepo.listPhotos(userId);
  }

  // ---- Privacidad de contacto ----

  async getContactPrivacy(userId: string): Promise<ContactPrivacy> {
    const found = await this.profileRepo.findContactPrivacy(userId);
    return found ?? ContactPrivacy.defaultsFor(userId);
  }

  async updateContactPrivacy(
    userId: string,
    updates: {
      showPhoneToConnections?: boolean;
      showEmailToConnections?: boolean;
      showSocialsToConnections?: boolean;
    },
  ): Promise<ContactPrivacy> {
    const privacy = await this.getContactPrivacy(userId);
    privacy.update(updates);
    await this.profileRepo.upsertContactPrivacy(privacy);
    return privacy;
  }

  // ---- Verificación de identidad ----

  async requestIdentityVerification(userId: string): Promise<Profile> {
    const profile = await this.getProfile(userId);
    profile.requestIdentityVerification();
    await this.profileRepo.updateIdentityStatus(profile);
    return profile;
  }

  // ---- Preferencias de notificación ----

  async getNotificationPreferences(
    userId: string,
  ): Promise<NotificationPreference[]> {
    return this.profileRepo.listNotificationPreferences(userId);
  }

  async updateNotificationPreference(
    userId: string,
    input: { type: NotificationType; inApp?: boolean; email?: boolean },
  ): Promise<NotificationPreference> {
    const existing = await this.profileRepo.findNotificationPreference(
      userId,
      input.type,
    );
    const preference =
      existing ??
      new NotificationPreference({
        userId,
        type: input.type,
        inApp: true,
        email: true,
      });
    preference.setChannels({
      ...(input.inApp !== undefined ? { inApp: input.inApp } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
    });
    await this.profileRepo.upsertNotificationPreference(preference);
    return preference;
  }

  private nextAvailablePosition(existing: ProfilePhoto[]): number {
    const taken = new Set(existing.map((p) => p.position));
    for (let i = ProfilePhoto.MIN_POSITION; i <= ProfilePhoto.MAX_POSITION; i++) {
      if (!taken.has(i)) return i;
    }
    throw new Error("No hay posiciones libres en la galería.");
  }
}
