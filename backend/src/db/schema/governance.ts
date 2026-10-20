import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  check,
  date,
  decimal,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { authUsers } from "./auth.js";
import {
  listingReviewStatuses,
  notificationTypes,
  reportReasons,
  reportStatuses,
  reportTargetTypes,
  sanctionTypes,
} from "./enums.js";
import { roomListings } from "./rooms.js";
import { chatMessages } from "./social.js";

export const agreementAgreements = mysqlTable("agreement_agreements", {
  id: char("id", { length: 36 })
    .primaryKey()
    .notNull()
    .default(sql`(UUID())`),
  listingId: char("listing_id", { length: 36 })
    .notNull()
    .references(() => roomListings.id, { onDelete: "cascade" }),
  rulesSnapshot: json("rules_snapshot")
    .$type<Record<string, unknown>>()
    .notNull(),
  createdAt: timestamp("created_at", { fsp: 6 }).notNull().defaultNow(),
});

export const agreementAcceptances = mysqlTable(
  "agreement_acceptances",
  {
    agreementId: char("agreement_id", { length: 36 })
      .notNull()
      .references(() => agreementAgreements.id, { onDelete: "cascade" }),
    userId: char("user_id", { length: 36 })
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    acceptedAt: timestamp("accepted_at", { fsp: 6 }),
  },
  (table) => [primaryKey({ columns: [table.agreementId, table.userId] })],
);

export const modReports = mysqlTable(
  "mod_reports",
  {
    id: char("id", { length: 36 })
      .primaryKey()
      .notNull()
      .default(sql`(UUID())`),
    reporterId: char("reporter_id", { length: 36 })
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    targetType: mysqlEnum("target_type", reportTargetTypes).notNull(),
    targetUserId: char("target_user_id", { length: 36 }).references(
      () => authUsers.id,
      { onDelete: "cascade" },
    ),
    targetListingId: char("target_listing_id", { length: 36 }).references(
      () => roomListings.id,
      { onDelete: "cascade" },
    ),
    targetMessageId: bigint("target_message_id", {
      mode: "number",
      unsigned: true,
    }).references(() => chatMessages.id, { onDelete: "cascade" }),
    reason: mysqlEnum("reason", reportReasons).notNull(),
    description: text("description"),
    status: mysqlEnum("status", reportStatuses).notNull().default("open"),
    createdAt: timestamp("created_at", { fsp: 6 }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { fsp: 6 }),
  },
  (table) => [
    check(
      "chk_report_target",
      sql`(${table.targetType} = 'user' AND ${table.targetUserId} IS NOT NULL) OR (${table.targetType} = 'listing' AND ${table.targetListingId} IS NOT NULL) OR (${table.targetType} = 'message' AND ${table.targetMessageId} IS NOT NULL)`,
    ),
    index("idx_mod_reports_queue").on(table.status, table.createdAt),
  ],
);

export const modSanctions = mysqlTable(
  "mod_sanctions",
  {
    id: char("id", { length: 36 })
      .primaryKey()
      .notNull()
      .default(sql`(UUID())`),
    reportId: char("report_id", { length: 36 }).references(() => modReports.id, {
      onDelete: "set null",
    }),
    adminId: char("admin_id", { length: 36 })
      .notNull()
      .references(() => authUsers.id),
    userId: char("user_id", { length: 36 }).references(() => authUsers.id, {
      onDelete: "cascade",
    }),
    listingId: char("listing_id", { length: 36 }).references(
      () => roomListings.id,
      { onDelete: "cascade" },
    ),
    type: mysqlEnum("type", sanctionTypes).notNull(),
    reason: text("reason").notNull(),
    expiresAt: timestamp("expires_at", { fsp: 6 }),
    createdAt: timestamp("created_at", { fsp: 6 }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "chk_sanction_target",
      sql`${table.userId} IS NOT NULL OR ${table.listingId} IS NOT NULL`,
    ),
    index("idx_mod_sanctions_user").on(table.userId),
  ],
);

export const modListingReviews = mysqlTable(
  "mod_listing_reviews",
  {
    listingId: char("listing_id", { length: 36 })
      .primaryKey()
      .notNull()
      .references(() => roomListings.id, { onDelete: "cascade" }),
    status: mysqlEnum("status", listingReviewStatuses)
      .notNull()
      .default("pending"),
    reviewerId: char("reviewer_id", { length: 36 }).references(
      () => authUsers.id,
    ),
    reason: text("reason"),
    reviewedAt: timestamp("reviewed_at", { fsp: 6 }),
    createdAt: timestamp("created_at", { fsp: 6 }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_mod_listing_reviews_queue").on(table.status, table.createdAt),
  ],
);

export const modActivityLog = mysqlTable(
  "mod_activity_log",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .autoincrement()
      .primaryKey(),
    userId: char("user_id", { length: 36 }).references(() => authUsers.id, {
      onDelete: "set null",
    }),
    action: varchar("action", { length: 160 }).notNull(),
    metadata: json("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`(JSON_OBJECT())`),
    ipAddress: varchar("ip_address", { length: 45 }),
    createdAt: timestamp("created_at", { fsp: 6 }).notNull().defaultNow(),
  },
  (table) => [index("idx_mod_activity_user").on(table.userId, table.createdAt)],
);

export const notifNotifications = mysqlTable(
  "notif_notifications",
  {
    id: char("id", { length: 36 })
      .primaryKey()
      .notNull()
      .default(sql`(UUID())`),
    userId: char("user_id", { length: 36 })
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    type: mysqlEnum("type", notificationTypes).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    body: text("body"),
    payload: json("payload")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`(JSON_OBJECT())`),
    emailSentAt: timestamp("email_sent_at", { fsp: 6 }),
    readAt: timestamp("read_at", { fsp: 6 }),
    createdAt: timestamp("created_at", { fsp: 6 }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_notif_user_unread").on(
      table.userId,
      table.readAt,
      table.createdAt,
    ),
    index("idx_notif_user").on(table.userId, table.createdAt),
  ],
);

export const notifPreferences = mysqlTable(
  "notif_preferences",
  {
    userId: char("user_id", { length: 36 })
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    type: mysqlEnum("type", notificationTypes).notNull(),
    inApp: boolean("in_app").notNull().default(true),
    email: boolean("email").notNull().default(true),
  },
  (table) => [primaryKey({ columns: [table.userId, table.type] })],
);

export const analyticsDailyMetrics = mysqlTable("analytics_daily_metrics", {
  metricDate: date("metric_date").primaryKey().notNull(),
  usersRegistered: int("users_registered", { unsigned: true }).notNull().default(0),
  activeListings: int("active_listings", { unsigned: true }).notNull().default(0),
  connectionsSent: int("connections_sent", { unsigned: true }).notNull().default(0),
  connectionsAccepted: int("connections_accepted", { unsigned: true })
    .notNull()
    .default(0),
  listingsClosed: int("listings_closed", { unsigned: true }).notNull().default(0),
  avgDaysToClose: decimal("avg_days_to_close", { precision: 6, scale: 2 }),
  avgAffinityScore: decimal("avg_affinity_score", { precision: 5, scale: 2 }),
  createdAt: timestamp("created_at", { fsp: 6 }).notNull().defaultNow(),
});

// Tipos generados automáticamente por Drizzle ORM
export type ModReportRow = typeof modReports.$inferSelect;
export type NewModReport = typeof modReports.$inferInsert;

export type ModSanctionRow = typeof modSanctions.$inferSelect;
export type NewModSanction = typeof modSanctions.$inferInsert;

export type ModListingReviewRow = typeof modListingReviews.$inferSelect;
export type NewModListingReview = typeof modListingReviews.$inferInsert;

export type ModActivityLogRow = typeof modActivityLog.$inferSelect;
export type NewModActivityLog = typeof modActivityLog.$inferInsert;

export type NotifNotificationRow = typeof notifNotifications.$inferSelect;
export type NewNotifNotification = typeof notifNotifications.$inferInsert;

export type NotifPreferenceRow = typeof notifPreferences.$inferSelect;
export type NewNotifPreference = typeof notifPreferences.$inferInsert;

export type AnalyticsDailyMetricRow = typeof analyticsDailyMetrics.$inferSelect;
export type NewAnalyticsDailyMetric = typeof analyticsDailyMetrics.$inferInsert;

