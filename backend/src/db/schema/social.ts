import { sql } from "drizzle-orm";
import {
  bigint,
  char,
  check,
  decimal,
  index,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { authUsers } from "./auth.js";
import { applicationStatuses, connectionStatuses } from "./enums.js";
import { roomListings } from "./rooms.js";

export const appApplications = mysqlTable(
  "app_applications",
  {
    id: char("id", { length: 36 })
      .primaryKey()
      .notNull()
      .default(sql`(UUID())`),
    listingId: char("listing_id", { length: 36 })
      .notNull()
      .references(() => roomListings.id, { onDelete: "cascade" }),
    applicantId: char("applicant_id", { length: 36 })
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    status: mysqlEnum("status", applicationStatuses)
      .notNull()
      .default("pending"),
    message: text("message"),
    compatibilityScore: decimal("compatibility_score", {
      precision: 5,
      scale: 2,
    }),
    createdAt: timestamp("created_at", { fsp: 6 }).notNull().defaultNow(),
    decidedAt: timestamp("decided_at", { fsp: 6 }),
  },
  (table) => [
    uniqueIndex("uq_app_listing_applicant").on(
      table.listingId,
      table.applicantId,
    ),
    check(
      "chk_app_compatibility_score",
      sql`${table.compatibilityScore} IS NULL OR ${table.compatibilityScore} BETWEEN 0 AND 100`,
    ),
    index("idx_app_listing").on(table.listingId, table.status, table.createdAt),
    index("idx_app_applicant").on(table.applicantId),
  ],
);

export const connConnections = mysqlTable(
  "conn_connections",
  {
    id: char("id", { length: 36 })
      .primaryKey()
      .notNull()
      .default(sql`(UUID())`),
    requesterId: char("requester_id", { length: 36 })
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    addresseeId: char("addressee_id", { length: 36 })
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    status: mysqlEnum("status", connectionStatuses)
      .notNull()
      .default("pending"),
    introMessage: varchar("intro_message", { length: 500 }),
    responseMessage: varchar("response_message", { length: 500 }),
    createdAt: timestamp("created_at", { fsp: 6 }).notNull().defaultNow(),
    respondedAt: timestamp("responded_at", { fsp: 6 }),
    activePairLow: char("active_pair_low", { length: 36 }),
    activePairHigh: char("active_pair_high", { length: 36 }),
  },
  (table) => [
    check(
      "chk_conn_distinct_users",
      sql`${table.requesterId} <> ${table.addresseeId}`,
    ),
    uniqueIndex("uq_conn_active_pair").on(
      table.activePairLow,
      table.activePairHigh,
    ),
    index("idx_conn_addressee").on(table.addresseeId, table.status),
    index("idx_conn_requester").on(table.requesterId, table.status),
  ],
);

export const chatRooms = mysqlTable(
  "chat_rooms",
  {
    id: char("id", { length: 36 })
      .primaryKey()
      .notNull()
      .default(sql`(UUID())`),
    connectionId: char("connection_id", { length: 36 }).references(
      () => connConnections.id,
      { onDelete: "cascade" },
    ),
    applicationId: char("application_id", { length: 36 }).references(
      () => appApplications.id,
      { onDelete: "cascade" },
    ),
    createdAt: timestamp("created_at", { fsp: 6 }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_chat_connection").on(table.connectionId),
    uniqueIndex("uq_chat_application").on(table.applicationId),
    check(
      "chk_chat_origin",
      sql`${table.connectionId} IS NOT NULL OR ${table.applicationId} IS NOT NULL`,
    ),
  ],
);

export const chatRoomMembers = mysqlTable(
  "chat_room_members",
  {
    roomId: char("room_id", { length: 36 })
      .notNull()
      .references(() => chatRooms.id, { onDelete: "cascade" }),
    userId: char("user_id", { length: 36 })
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    lastReadAt: timestamp("last_read_at", { fsp: 6 }),
  },
  (table) => [
    primaryKey({ columns: [table.roomId, table.userId] }),
    index("idx_chat_members_user").on(table.userId),
  ],
);

export const chatMessages = mysqlTable(
  "chat_messages",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .autoincrement()
      .primaryKey(),
    roomId: char("room_id", { length: 36 })
      .notNull()
      .references(() => chatRooms.id, { onDelete: "cascade" }),
    senderId: char("sender_id", { length: 36 })
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    sentAt: timestamp("sent_at", { fsp: 6 }).notNull().defaultNow(),
    deliveredAt: timestamp("delivered_at", { fsp: 6 }),
    readAt: timestamp("read_at", { fsp: 6 }),
  },
  (table) => [
    check(
      "chk_chat_message_length",
      sql`CHAR_LENGTH(${table.body}) BETWEEN 1 AND 4000`,
    ),
    index("idx_chat_messages_room").on(table.roomId, table.id),
  ],
);
