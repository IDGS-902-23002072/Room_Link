export type UserRole = "seeker" | "host" | "admin";
export type AccountStatus = "active" | "suspended" | "banned" | "deleted";
export type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";
export type ListingStatus = "draft" | "published" | "paused" | "closed";
export type ApplicationStatus = "pending" | "waitlisted" | "rejected" | "accepted";
export type SeekingType = "room" | "roommate" | "both";

export interface UserProps {
  id: string;
  email: string;
  passwordHash?: string | null | undefined;
  status: AccountStatus;
  roles?: UserRole[] | undefined;
  emailVerifiedAt?: Date | null | undefined;
  termsAcceptedAt: Date;
  failedLoginAttempts?: number | undefined;
  lockedUntil?: Date | null | undefined;
  lastLoginAt?: Date | null | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export class User {
  private props: UserProps;

  constructor(props: UserProps) {
    this.validateEmail(props.email);
    this.props = {
      ...props,
      roles: props.roles ?? ["seeker"],
      failedLoginAttempts: props.failedLoginAttempts ?? 0,
    };
  }

  get id(): string {
    return this.props.id;
  }

  get email(): string {
    return this.props.email;
  }

  get passwordHash(): string | null | undefined {
    return this.props.passwordHash;
  }

  get status(): AccountStatus {
    return this.props.status;
  }

  get roles(): UserRole[] {
    return [...(this.props.roles ?? [])];
  }

  get emailVerifiedAt(): Date | null | undefined {
    return this.props.emailVerifiedAt;
  }

  get termsAcceptedAt(): Date {
    return this.props.termsAcceptedAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get failedLoginAttempts(): number {
    return this.props.failedLoginAttempts ?? 0;
  }

  get lockedUntil(): Date | null | undefined {
    return this.props.lockedUntil;
  }

  get lastLoginAt(): Date | null | undefined {
    return this.props.lastLoginAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  public isActive(): boolean {
    return this.props.status === "active";
  }

  public isEmailVerified(): boolean {
    return Boolean(this.props.emailVerifiedAt);
  }

  public hasRole(role: UserRole): boolean {
    return this.props.roles?.includes(role) ?? false;
  }

  public isLocked(at: Date = new Date()): boolean {
    return Boolean(this.props.lockedUntil && this.props.lockedUntil > at);
  }

  public recordFailedLogin(at: Date = new Date()): void {
    this.props.failedLoginAttempts = (this.props.failedLoginAttempts ?? 0) + 1;
    if (this.props.failedLoginAttempts >= 5) {
      this.props.lockedUntil = new Date(at.getTime() + 15 * 60 * 1000);
    }
    this.props.updatedAt = at;
  }

  public recordSuccessfulLogin(at: Date = new Date()): void {
    this.props.failedLoginAttempts = 0;
    this.props.lockedUntil = null;
    this.props.lastLoginAt = at;
    this.props.updatedAt = at;
  }

  public changePassword(passwordHash: string, at: Date = new Date()): void {
    if (!passwordHash) {
      throw new Error("El hash de contraseña es requerido.");
    }
    this.props.passwordHash = passwordHash;
    this.props.failedLoginAttempts = 0;
    this.props.lockedUntil = null;
    this.props.updatedAt = at;
  }

  public verifyEmail(date: Date = new Date()): void {
    this.props.emailVerifiedAt = date;
    this.props.updatedAt = new Date();
  }

  public toJSON(): Record<string, unknown> {
    return {
      id: this.props.id,
      email: this.props.email,
      status: this.props.status,
      roles: this.props.roles,
      emailVerifiedAt: this.props.emailVerifiedAt,
      lastLoginAt: this.props.lastLoginAt,
      createdAt: this.props.createdAt,
    };
  }

  private validateEmail(email: string): void {
    if (!email || !email.includes("@")) {
      throw new Error(`Email de usuario inválido: ${email}`);
    }
  }
}
