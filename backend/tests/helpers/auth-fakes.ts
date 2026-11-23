import type { IUserRepository, User } from "../../src/domain/index.js";
import type {
  AuthServiceDependencies,
  AuthSessionRecord,
  OAuthProfile,
  PasswordResetRecord,
} from "../../src/modules/auth/index.js";

export class InMemoryUserRepository implements IUserRepository {
  readonly users = new Map<string, User>();

  findById = async (id: string): Promise<User | null> => this.users.get(id) ?? null;
  findByEmail = async (email: string): Promise<User | null> =>
    [...this.users.values()].find((user) => user.email === email) ?? null;
  create = async (user: User): Promise<User> => {
    this.users.set(user.id, user);
    return user;
  };
  update = async (user: User): Promise<void> => {
    this.users.set(user.id, user);
  };
  delete = async (id: string): Promise<void> => {
    this.users.delete(id);
  };
}

export class MutableClock {
  constructor(public value = new Date("2026-11-05T12:00:00.000Z")) {}
  now = (): Date => new Date(this.value);
  advance(minutes: number): void {
    this.value = new Date(this.value.getTime() + minutes * 60 * 1000);
  }
}

export const createAuthFakes = (clock = new MutableClock()) => {
  let tokenCounter = 0;
  const sessions = new Map<string, AuthSessionRecord>();
  const resets = new Map<string, PasswordResetRecord>();
  const identities = new Map<string, string>();
  const emails: Array<{ email: string; token: string; expiresAt: Date }> = [];
  const events: Array<{ type: string; aggregateId: string; payload: Record<string, unknown> }> = [];
  let oauthProfile: OAuthProfile = {
    provider: "google",
    providerUserId: "google-user-1",
    email: "google@roomlink.test",
    emailVerified: true,
  };

  const dependencies: AuthServiceDependencies = {
    clock,
    passwordHasher: {
      hash: async (password) => `hash:${password}`,
      verify: async (password, hash) => hash === `hash:${password}`,
    },
    tokenGenerator: {
      generate: () => `token-${++tokenCounter}`,
      hash: (token) => `digest:${token}`,
    },
    sessionRepository: {
      create: async (session) => {
        sessions.set(session.tokenHash, session);
      },
      findActiveByTokenHash: async (hash, at) => {
        const session = sessions.get(hash);
        return session && !session.revokedAt && session.expiresAt > at ? session : null;
      },
      revoke: async (id, at) => {
        const session = [...sessions.values()].find((item) => item.id === id);
        if (session) session.revokedAt = at;
      },
      revokeAllForUser: async (userId, at) => {
        for (const session of sessions.values()) {
          if (session.userId === userId && !session.revokedAt) session.revokedAt = at;
        }
      },
    },
    resetRepository: {
      create: async (record) => {
        resets.set(record.tokenHash, record);
      },
      findByTokenHash: async (hash) => resets.get(hash) ?? null,
      markUsed: async (id, at) => {
        const record = [...resets.values()].find((item) => item.id === id);
        if (record) record.usedAt = at;
      },
      invalidateForUser: async (userId, at) => {
        for (const record of resets.values()) {
          if (record.userId === userId && !record.usedAt) record.usedAt = at;
        }
      },
    },
    oauthIdentityRepository: {
      findUserId: async (provider, id) => identities.get(`${provider}:${id}`) ?? null,
      create: async (identity) => {
        identities.set(`${identity.provider}:${identity.providerUserId}`, identity.userId);
      },
    },
    oauthProvider: {
      verify: async () => oauthProfile,
    },
    emailNotifier: {
      sendPasswordReset: async (input) => {
        emails.push(input);
      },
    },
    eventPublisher: {
      publish: async (event) => {
        events.push(event);
      },
    },
  };

  return {
    dependencies,
    sessions,
    resets,
    emails,
    events,
    identities,
    setOAuthProfile: (value: OAuthProfile) => {
      oauthProfile = value;
    },
  };
};
