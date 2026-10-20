import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  check,
  index,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  smallint,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { accountStatuses, oauthProviders, userRoles } from "./enums.js";

export const authUsers = mysqlTable(
  "auth_users",
  {
    id: char("id", { length: 36 })
      .primaryKey()
      .notNull()
      .default(sql`(UUID())`),
    email: varchar("email", { length: 254 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }),
    status: mysqlEnum("status", accountStatuses).notNull().default("active"),
    emailVerifiedAt: timestamp("email_verified_at", { fsp: 6 }),
    termsAcceptedAt: timestamp("terms_accepted_at", { fsp: 6 }).notNull(),
    failedLoginAttempts: smallint("failed_login_attempts", { unsigned: true })
      .notNull()
      .default(0),
    lockedUntil: timestamp("locked_until", { fsp: 6 }),
    lastLoginAt: timestamp("last_login_at", { fsp: 6 }),
    createdAt: timestamp("created_at", { fsp: 6 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .onUpdateNow(),
  },
  (table) => [
    uniqueIndex("uq_auth_users_email").on(table.email),
    check(
      "chk_auth_users_credential",
      sql`${table.passwordHash} IS NOT NULL OR ${table.emailVerifiedAt} IS NOT NULL`,
    ),
  ],
);

export const authUserRoles = mysqlTable(
  "auth_user_roles",
  {
    userId: char("user_id", { length: 36 })
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    role: mysqlEnum("role", userRoles).notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.role] })],
);

export const authOauthIdentities = mysqlTable(
  "auth_oauth_identities",
  {
    id: char("id", { length: 36 })
      .primaryKey()
      .notNull()
      .default(sql`(UUID())`),
    userId: char("user_id", { length: 36 })
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    provider: mysqlEnum("provider", oauthProviders).notNull(),
    providerUserId: varchar("provider_user_id", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { fsp: 6 }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_auth_oauth_provider_identity").on(
      table.provider,
      table.providerUserId,
    ),
    uniqueIndex("uq_auth_oauth_user_provider").on(
      table.userId,
      table.provider,
    ),
  ],
);

export const authPasswordResetTokens = mysqlTable(
  "auth_password_reset_tokens",
  {
    id: char("id", { length: 36 })
      .primaryKey()
      .notNull()
      .default(sql`(UUID())`),
    userId: char("user_id", { length: 36 })
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 255 }).notNull(),
    expiresAt: timestamp("expires_at", { fsp: 6 }).notNull(),
    usedAt: timestamp("used_at", { fsp: 6 }),
    createdAt: timestamp("created_at", { fsp: 6 }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_auth_reset_token_hash").on(table.tokenHash),
    index("idx_auth_reset_user").on(table.userId),
  ],
);

export const authSessions = mysqlTable(
  "auth_sessions",
  {
    id: char("id", { length: 36 })
      .primaryKey()
      .notNull()
      .default(sql`(UUID())`),
    userId: char("user_id", { length: 36 })
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 255 }).notNull(),
    userAgent: varchar("user_agent", { length: 500 }),
    ipAddress: varchar("ip_address", { length: 45 }),
    createdAt: timestamp("created_at", { fsp: 6 }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { fsp: 6 }).notNull(),
    revokedAt: timestamp("revoked_at", { fsp: 6 }),
  },
  (table) => [
    uniqueIndex("uq_auth_sessions_token_hash").on(table.tokenHash),
    index("idx_auth_sessions_user_active").on(table.userId, table.revokedAt),
  ],
);

export const authLoginAttempts = mysqlTable(
  "auth_login_attempts",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .autoincrement()
      .primaryKey(),
    email: varchar("email", { length: 254 }).notNull(),
    userId: char("user_id", { length: 36 }).references(() => authUsers.id, {
      onDelete: "set null",
    }),
    success: boolean("success").notNull(),
    ipAddress: varchar("ip_address", { length: 45 }),
    createdAt: timestamp("created_at", { fsp: 6 }).notNull().defaultNow(),
  },
  (table) => [index("idx_auth_attempts_email").on(table.email, table.createdAt)],
);
