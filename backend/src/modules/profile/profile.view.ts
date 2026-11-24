import type {
  Profile,
  ProfilePhoto,
  ContactPrivacy,
  ProfileNotificationPreference,
} from "../../domain/index.js";

export interface ProfileResponseDto {
  userId: string;
  fullName: string;
  birthDate: string;
  age: number;
  occupation: string | null;
  bio: string | null;
  phone: string | null;
  instagram: string | null;
  facebook: string | null;
  identityStatus: string;
  identityVerifiedAt: string | null;
  isVerified: boolean;
}

export interface ProfilePhotoDto {
  id: string;
  url: string;
  position: number;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  isMain: boolean;
}

export interface ContactPrivacyDto {
  userId: string;
  showPhoneToConnections: boolean;
  showEmailToConnections: boolean;
  showSocialsToConnections: boolean;
}

export interface NotificationPreferenceDto {
  type: string;
  inApp: boolean;
  email: boolean;
}

/**
 * HU-02 — Controla la visibilidad de los datos de contacto según el espectador.
 * Si se omite (`undefined`), equivale a la vista del propio dueño: se muestra todo.
 */
export interface ProfileVisibility {
  /** El espectador es el dueño del perfil. */
  isOwner: boolean;
  /** Existe una conexión aceptada entre espectador y dueño. */
  isConnected: boolean;
  /** Preferencias de privacidad del dueño (null si no hay registro). */
  privacy: ContactPrivacy | null;
}

/** Vista / Serializador para el módulo de Perfiles (HU-02). */
export class ProfileView {
  public static toPublicProfile(
    profile: Profile,
    visibility?: ProfileVisibility,
  ): ProfileResponseDto {
    // Un dato de contacto es visible si: no se pasó visibility (vista propia),
    // el espectador es el dueño, o es una conexión aceptada Y el dueño permite
    // compartir ese dato con sus conexiones.
    const visible = (allowedToConnections: boolean): boolean =>
      !visibility ||
      visibility.isOwner ||
      (visibility.isConnected && allowedToConnections);

    const phoneVisible = visible(visibility?.privacy?.showPhoneToConnections ?? false);
    const socialsVisible = visible(
      visibility?.privacy?.showSocialsToConnections ?? false,
    );

    return {
      userId: profile.userId,
      fullName: profile.fullName,
      birthDate: profile.birthDate.toISOString().split("T")[0] ?? "",
      age: profile.getAge(),
      occupation: profile.occupation ?? null,
      bio: profile.bio ?? null,
      phone: phoneVisible ? (profile.phone ?? null) : null,
      instagram: socialsVisible ? (profile.instagram ?? null) : null,
      facebook: socialsVisible ? (profile.facebook ?? null) : null,
      identityStatus: profile.identityStatus,
      identityVerifiedAt: profile.identityVerifiedAt
        ? profile.identityVerifiedAt.toISOString()
        : null,
      isVerified: profile.isIdentityVerified(),
    };
  }

  public static toPhotoDto(photo: ProfilePhoto): ProfilePhotoDto {
    const ext = photo.url.split(".").pop()?.toLowerCase();
    const mimeType =
      ext === "png"
        ? "image/png"
        : ext === "webp"
          ? "image/webp"
          : "image/jpeg";
    return {
      id: photo.id,
      url: photo.url,
      position: photo.position,
      mimeType,
      sizeBytes: 0,
      createdAt: photo.createdAt.toISOString(),
      isMain: photo.isMain(),
    };
  }

  public static toPrivacyDto(privacy: ContactPrivacy): ContactPrivacyDto {
    return {
      userId: privacy.userId,
      showPhoneToConnections: privacy.showPhoneToConnections,
      showEmailToConnections: privacy.showEmailToConnections,
      showSocialsToConnections: privacy.showSocialsToConnections,
    };
  }

  public static toNotifPrefDto(
    preference: ProfileNotificationPreference,
  ): NotificationPreferenceDto {
    return {
      type: preference.type,
      inApp: preference.inApp,
      email: preference.email,
    };
  }
}
