import type { User, UserRole } from "../../domain/index.js";

export interface AuthPrincipal {
  userId: string;
  roles: UserRole[];
  sessionId: string;
}

export interface AuthSessionRecord {
  id: string;
  userId: string;
  tokenHash: string;
  userAgent?: string | null | undefined;
  ipAddress?: string | null | undefined;
  createdAt: Date;
  expiresAt: Date;
  revokedAt?: Date | null;
}

export interface PasswordResetRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt?: Date | null;
  createdAt: Date;
}

export interface OAuthProfile {
  provider: "google";
  providerUserId: string;
  email: string;
  emailVerified: boolean;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
}

export interface SecureTokenGenerator {
  generate(): string;
  hash(token: string): string;
}

export interface AuthSessionRepository {
  create(session: AuthSessionRecord): Promise<void>;
  findActiveByTokenHash(tokenHash: string, at: Date): Promise<AuthSessionRecord | null>;
  revoke(id: string, at: Date): Promise<void>;
  revokeAllForUser(userId: string, at: Date): Promise<void>;
}

export interface PasswordResetRepository {
  create(record: PasswordResetRecord): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<PasswordResetRecord | null>;
  markUsed(id: string, at: Date): Promise<void>;
  invalidateForUser(userId: string, at: Date): Promise<void>;
}

export interface OAuthIdentityRepository {
  findUserId(provider: "google", providerUserId: string): Promise<string | null>;
  create(input: { id: string; userId: string; provider: "google"; providerUserId: string }): Promise<void>;
}

export interface OAuthProfileProvider {
  verify(idToken: string): Promise<OAuthProfile>;
}

export interface EmailNotifier {
  sendPasswordReset(input: { email: string; token: string; expiresAt: Date }): Promise<void>;
}

export interface DomainEventPublisher {
  publish(event: { type: string; aggregateId: string; payload: Record<string, unknown> }): Promise<void>;
}

export interface Clock {
  now(): Date;
}

/**
 * Puerto delgado usado por AuthService para saber si un usuario tiene una sanción
 * activa que bloquee su sesión. Lo implementa `SanctionsService` sin acoplar auth
 * al módulo de sanciones.
 */
export interface SessionGuard {
  isBlocked(userId: string): Promise<boolean>;
}

export interface AuthServiceDependencies {
  passwordHasher: PasswordHasher;
  tokenGenerator: SecureTokenGenerator;
  sessionRepository: AuthSessionRepository;
  resetRepository: PasswordResetRepository;
  oauthIdentityRepository: OAuthIdentityRepository;
  oauthProvider: OAuthProfileProvider;
  emailNotifier: EmailNotifier;
  eventPublisher: DomainEventPublisher;
  clock?: Clock;
  sessionGuard?: SessionGuard;
}

export interface AuthResult {
  user: User;
  token: string;
  expiresAt: Date;
}
