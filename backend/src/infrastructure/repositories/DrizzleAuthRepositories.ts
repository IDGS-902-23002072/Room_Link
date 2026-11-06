import { and, eq, gt, isNull } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  authOauthIdentities,
  authPasswordResetTokens,
  authSessions,
  type AuthOauthIdentityRow,
  type AuthPasswordResetTokenRow,
  type AuthSessionRow,
  type NewAuthOauthIdentity,
  type NewAuthPasswordResetToken,
  type NewAuthSession,
} from "../../db/schema/auth.js";
import { coreOutboxEvents, type NewCoreOutboxEvent } from "../../db/schema/core.js";
import type {
  AuthSessionRecord,
  AuthSessionRepository,
  DomainEventPublisher,
  OAuthIdentityRepository,
  PasswordResetRecord,
  PasswordResetRepository,
} from "../../modules/auth/auth.ports.js";

export class DrizzleAuthSessionRepository implements AuthSessionRepository {
  constructor(private readonly db: MySql2Database<any>) {}

  async create(session: AuthSessionRecord): Promise<void> {
    const record: NewAuthSession = {
      id: session.id,
      userId: session.userId,
      tokenHash: session.tokenHash,
      userAgent: session.userAgent ?? null,
      ipAddress: session.ipAddress ?? null,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      revokedAt: session.revokedAt ?? null,
    };
    await this.db.insert(authSessions).values(record);
  }

  async findActiveByTokenHash(tokenHash: string, at: Date): Promise<AuthSessionRecord | null> {
    const rows: AuthSessionRow[] = await this.db
      .select()
      .from(authSessions)
      .where(
        and(
          eq(authSessions.tokenHash, tokenHash),
          isNull(authSessions.revokedAt),
          gt(authSessions.expiresAt, at),
        ),
      )
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      userId: row.userId,
      tokenHash: row.tokenHash,
      userAgent: row.userAgent,
      ipAddress: row.ipAddress,
      createdAt: new Date(row.createdAt),
      expiresAt: new Date(row.expiresAt),
      revokedAt: row.revokedAt ? new Date(row.revokedAt) : null,
    };
  }

  async revoke(id: string, at: Date): Promise<void> {
    await this.db.update(authSessions).set({ revokedAt: at }).where(eq(authSessions.id, id));
  }

  async revokeAllForUser(userId: string, at: Date): Promise<void> {
    await this.db
      .update(authSessions)
      .set({ revokedAt: at })
      .where(and(eq(authSessions.userId, userId), isNull(authSessions.revokedAt)));
  }
}

export class DrizzlePasswordResetRepository implements PasswordResetRepository {
  constructor(private readonly db: MySql2Database<any>) {}

  async create(record: PasswordResetRecord): Promise<void> {
    const value: NewAuthPasswordResetToken = {
      id: record.id,
      userId: record.userId,
      tokenHash: record.tokenHash,
      expiresAt: record.expiresAt,
      usedAt: record.usedAt ?? null,
      createdAt: record.createdAt,
    };
    await this.db.insert(authPasswordResetTokens).values(value);
  }

  async findByTokenHash(tokenHash: string): Promise<PasswordResetRecord | null> {
    const rows: AuthPasswordResetTokenRow[] = await this.db
      .select()
      .from(authPasswordResetTokens)
      .where(eq(authPasswordResetTokens.tokenHash, tokenHash))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      userId: row.userId,
      tokenHash: row.tokenHash,
      expiresAt: new Date(row.expiresAt),
      usedAt: row.usedAt ? new Date(row.usedAt) : null,
      createdAt: new Date(row.createdAt),
    };
  }

  async markUsed(id: string, at: Date): Promise<void> {
    await this.db
      .update(authPasswordResetTokens)
      .set({ usedAt: at })
      .where(eq(authPasswordResetTokens.id, id));
  }

  async invalidateForUser(userId: string, at: Date): Promise<void> {
    await this.db
      .update(authPasswordResetTokens)
      .set({ usedAt: at })
      .where(and(eq(authPasswordResetTokens.userId, userId), isNull(authPasswordResetTokens.usedAt)));
  }
}

export class DrizzleOAuthIdentityRepository implements OAuthIdentityRepository {
  constructor(private readonly db: MySql2Database<any>) {}

  async findUserId(provider: "google", providerUserId: string): Promise<string | null> {
    const rows: AuthOauthIdentityRow[] = await this.db
      .select()
      .from(authOauthIdentities)
      .where(
        and(
          eq(authOauthIdentities.provider, provider),
          eq(authOauthIdentities.providerUserId, providerUserId),
        ),
      )
      .limit(1);
    return rows[0]?.userId ?? null;
  }

  async create(input: {
    id: string;
    userId: string;
    provider: "google";
    providerUserId: string;
  }): Promise<void> {
    const record: NewAuthOauthIdentity = input;
    await this.db.insert(authOauthIdentities).values(record);
  }
}

export class DrizzleOutboxEventPublisher implements DomainEventPublisher {
  constructor(private readonly db: MySql2Database<any>) {}

  async publish(event: {
    type: string;
    aggregateId: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    const record: NewCoreOutboxEvent = {
      eventType: event.type,
      aggregateId: event.aggregateId,
      payload: event.payload,
    };
    await this.db.insert(coreOutboxEvents).values(record);
  }
}
