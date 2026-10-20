import type { Profile } from "../../domain/index.js";

export interface ProfileResponseDto {
  userId: string;
  fullName: string;
  birthDate: string;
  age: number;
  occupation: string | null;
  bio: string | null;
  phone: string | null;
  identityStatus: string;
  isVerified: boolean;
}

/**
 * Vista / Serializador para el módulo de Perfiles.
 */
export class ProfileView {
  public static toPublicProfile(profile: Profile): ProfileResponseDto {
    return {
      userId: profile.userId,
      fullName: profile.fullName,
      birthDate: profile.birthDate.toISOString().split("T")[0] ?? "",
      age: profile.getAge(),
      occupation: profile.occupation ?? null,
      bio: profile.bio ?? null,
      phone: profile.phone ?? null,
      identityStatus: profile.identityStatus,
      isVerified: profile.isIdentityVerified(),
    };
  }
}
