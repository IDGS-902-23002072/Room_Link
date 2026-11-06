import { Profile, type IProfileRepository } from "../../domain/index.js";

export interface CreateProfileInput {
  userId: string;
  fullName: string;
  birthDate: string; // YYYY-MM-DD
  occupation?: string | null | undefined;
  bio?: string | null | undefined;
  phone?: string | null | undefined;
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

    // Regla de negocio del dominio: valida que tenga al menos 18 años
    const profile = new Profile({
      userId: input.userId,
      fullName: input.fullName,
      birthDate: birthDateObj,
      occupation: input.occupation ?? null,
      bio: input.bio ?? null,
      phone: input.phone ?? null,
      identityStatus: "unverified",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return await this.profileRepo.create(profile);
  }

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
}
