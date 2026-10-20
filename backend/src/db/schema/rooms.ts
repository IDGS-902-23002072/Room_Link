import { sql } from "drizzle-orm";
import {
  boolean,
  char,
  check,
  date,
  decimal,
  index,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { authUsers } from "./auth.js";
import { costKinds, listingStatuses } from "./enums.js";
import { geoLocations } from "./geo.js";

export const roomListings = mysqlTable(
  "room_listings",
  {
    id: char("id", { length: 36 })
      .primaryKey()
      .notNull()
      .default(sql`(UUID())`),
    hostId: char("host_id", { length: 36 })
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    locationId: char("location_id", { length: 36 }).references(
      () => geoLocations.id,
    ),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    monthlyRent: decimal("monthly_rent", { precision: 10, scale: 2 }).notNull(),
    availableFrom: date("available_from"),
    maxRoommates: smallint("max_roommates", { unsigned: true }),
    status: mysqlEnum("status", listingStatuses).notNull().default("draft"),
    publishedAt: timestamp("published_at", { fsp: 6 }),
    closedAt: timestamp("closed_at", { fsp: 6 }),
    createdAt: timestamp("created_at", { fsp: 6 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .onUpdateNow(),
  },
  (table) => [
    check("chk_listing_rent", sql`${table.monthlyRent} >= 0`),
    check(
      "chk_listing_max_roommates",
      sql`${table.maxRoommates} IS NULL OR ${table.maxRoommates} >= 1`,
    ),
    check(
      "chk_listing_publish_needs_location",
      sql`${table.status} = 'draft' OR ${table.locationId} IS NOT NULL`,
    ),
    index("idx_room_listings_host").on(table.hostId, table.status),
    index("idx_room_listings_search").on(table.status, table.monthlyRent),
  ],
);

export const roomPhotos = mysqlTable(
  "room_photos",
  {
    id: char("id", { length: 36 })
      .primaryKey()
      .notNull()
      .default(sql`(UUID())`),
    listingId: char("listing_id", { length: 36 })
      .notNull()
      .references(() => roomListings.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    position: smallint("position", { unsigned: true }).notNull(),
    createdAt: timestamp("created_at", { fsp: 6 }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_room_photo_position").on(table.listingId, table.position),
    check("chk_room_photo_position", sql`${table.position} >= 1`),
  ],
);

export const roomRules = mysqlTable("room_rules", {
  listingId: char("listing_id", { length: 36 })
    .primaryKey()
    .notNull()
    .references(() => roomListings.id, { onDelete: "cascade" }),
  visitsPolicy: text("visits_policy"),
  partiesAllowed: boolean("parties_allowed").notNull().default(false),
  quietHoursStart: time("quiet_hours_start"),
  quietHoursEnd: time("quiet_hours_end"),
  petsAllowed: boolean("pets_allowed").notNull().default(false),
  smokingAllowed: boolean("smoking_allowed").notNull().default(false),
  commonAreasNotes: text("common_areas_notes"),
  extraRules: text("extra_rules"),
});

export const roomCostItems = mysqlTable(
  "room_cost_items",
  {
    id: char("id", { length: 36 })
      .primaryKey()
      .notNull()
      .default(sql`(UUID())`),
    listingId: char("listing_id", { length: 36 })
      .notNull()
      .references(() => roomListings.id, { onDelete: "cascade" }),
    kind: mysqlEnum("kind", costKinds).notNull(),
    concept: varchar("concept", { length: 160 }).notNull(),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull().default("0"),
    isIncluded: boolean("is_included").notNull().default(false),
    isProrated: boolean("is_prorated").notNull().default(false),
  },
  (table) => [
    check("chk_room_cost_amount", sql`${table.amount} >= 0`),
    check(
      "chk_cost_included_prorated",
      sql`NOT (${table.isIncluded} AND ${table.isProrated})`,
    ),
    index("idx_room_cost_listing").on(table.listingId),
  ],
);

export const roomFavorites = mysqlTable(
  "room_favorites",
  {
    userId: char("user_id", { length: 36 })
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    listingId: char("listing_id", { length: 36 })
      .notNull()
      .references(() => roomListings.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { fsp: 6 }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.listingId] })],
);
