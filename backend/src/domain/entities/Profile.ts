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

  get identityStatus(): VerificationStatus {
    return this.props.identityStatus ?? "unverified";
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
    if (details.fullName) this.props.fullName = details.fullName;
    if (details.bio !== undefined) this.props.bio = details.bio;
    if (details.occupation !== undefined) this.props.occupation = details.occupation;
    if (details.phone !== undefined) this.props.phone = details.phone;
    this.props.updatedAt = new Date();
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
      identityStatus: this.props.identityStatus,
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
