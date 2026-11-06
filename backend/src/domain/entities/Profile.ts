import type { VerificationStatus } from "./User.js";

export interface ProfileProps {
  userId: string;
  fullName: string;
  birthDate: Date;
  occupation?: string | null | undefined;
  bio?: string | null | undefined;
  phone?: string | null | undefined;
  instagram?: string | null | undefined;
  facebook?: string | null | undefined;
  identityStatus?: VerificationStatus | undefined;
  identityVerifiedAt?: Date | null | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export class Profile {
  private props: ProfileProps;

  constructor(props: ProfileProps) {
    this.validateAge(props.birthDate);
    this.props = {
      ...props,
      identityStatus: props.identityStatus ?? "unverified",
    };
  }

  get userId(): string {
    return this.props.userId;
  }

  get fullName(): string {
    return this.props.fullName;
  }

  get birthDate(): Date {
    return this.props.birthDate;
  }

  get occupation(): string | null | undefined {
    return this.props.occupation;
  }

  get bio(): string | null | undefined {
    return this.props.bio;
  }

  get phone(): string | null | undefined {
    return this.props.phone;
  }

  get instagram(): string | null | undefined {
    return this.props.instagram;
  }

  get facebook(): string | null | undefined {
    return this.props.facebook;
  }

  get identityStatus(): VerificationStatus {
    return this.props.identityStatus ?? "unverified";
  }

  get identityVerifiedAt(): Date | null | undefined {
    return this.props.identityVerifiedAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  public getAge(relativeTo: Date = new Date()): number {
    const diff = relativeTo.getTime() - this.props.birthDate.getTime();
    const ageDate = new Date(diff);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  }

  public isIdentityVerified(): boolean {
    return this.props.identityStatus === "verified";
  }

  public updateDetails(details: {
    fullName?: string | undefined;
    bio?: string | null | undefined;
    occupation?: string | null | undefined;
    phone?: string | null | undefined;
  }): void {
    if (details.fullName) {
      Profile.validateFullName(details.fullName);
      this.props.fullName = details.fullName;
    }
    if (details.bio !== undefined) {
      Profile.validateBio(details.bio);
      this.props.bio = details.bio;
    }
    if (details.occupation !== undefined) {
      Profile.validateOccupation(details.occupation);
      this.props.occupation = details.occupation;
    }
    if (details.phone !== undefined) {
      Profile.validatePhone(details.phone);
      this.props.phone = details.phone;
    }
    this.props.updatedAt = new Date();
  }

  public updateSocials(socials: {
    instagram?: string | null | undefined;
    facebook?: string | null | undefined;
  }): void {
    if (socials.instagram !== undefined) {
      Profile.validateSocialHandle(socials.instagram, "instagram");
      this.props.instagram = socials.instagram;
    }
    if (socials.facebook !== undefined) {
      Profile.validateSocialHandle(socials.facebook, "facebook");
      this.props.facebook = socials.facebook;
    }
    this.props.updatedAt = new Date();
  }

  public requestIdentityVerification(): void {
    if (this.props.identityStatus === "verified") {
      throw new Error("La identidad del usuario ya está verificada.");
    }
    this.props.identityStatus = "pending";
    this.props.updatedAt = new Date();
  }

  public markIdentityVerified(now: Date = new Date()): void {
    this.props.identityStatus = "verified";
    this.props.identityVerifiedAt = now;
    this.props.updatedAt = now;
  }

  public rejectIdentityVerification(): void {
    this.props.identityStatus = "rejected";
    this.props.updatedAt = new Date();
  }

  public static validateFullName(value: string): void {
    if (!value || value.trim().length < 2) {
      throw new Error("El nombre completo debe tener al menos 2 caracteres.");
    }
    if (value.length > 200) {
      throw new Error("El nombre completo supera los 200 caracteres.");
    }
  }

  public static validateBio(value: string | null): void {
    if (value && value.length > 300) {
      throw new Error("La biografía supera los 300 caracteres.");
    }
  }

  public static validateOccupation(value: string | null): void {
    if (value && value.length > 160) {
      throw new Error("La ocupación supera los 160 caracteres.");
    }
  }

  public static validatePhone(value: string | null): void {
    if (value === null || value === undefined || value === "") return;
    if (value.length > 30) {
      throw new Error("El teléfono supera los 30 caracteres.");
    }
    if (!/^[+\d][\d\s().-]{5,29}$/.test(value)) {
      throw new Error("El teléfono tiene un formato inválido.");
    }
  }

  public static validateSocialHandle(
    value: string | null,
    field: "instagram" | "facebook",
  ): void {
    if (value === null || value === undefined || value === "") return;
    if (value.length > 255) {
      throw new Error(`El enlace de ${field} supera los 255 caracteres.`);
    }
  }

  public toJSON(): Record<string, unknown> {
    return {
      userId: this.props.userId,
      fullName: this.props.fullName,
      birthDate: this.props.birthDate.toISOString().split("T")[0],
      age: this.getAge(),
      occupation: this.props.occupation,
      bio: this.props.bio,
      phone: this.props.phone,
      instagram: this.props.instagram,
      facebook: this.props.facebook,
      identityStatus: this.props.identityStatus,
      identityVerifiedAt: this.props.identityVerifiedAt
        ? this.props.identityVerifiedAt.toISOString()
        : null,
    };
  }

  private validateAge(birthDate: Date): void {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    if (age < 18) {
      throw new Error("El usuario debe tener al menos 18 años cumplidos.");
    }
  }
}
