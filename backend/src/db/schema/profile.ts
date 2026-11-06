import { sql } from "drizzle-orm";
import {
  boolean,
  char,
  check,
  date,
  decimal,
  mysqlEnum,
  mysqlTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { authUsers } from "./auth.js";
import { seekingTypes, verificationStatuses } from "./enums.js";
import { geoZones } from "./geo.js";

export const profileProfiles = mysqlTable("profile_profiles", {
  userId: char("user_id", { length: 36 })
    .primaryKey()
    .notNull()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  fullName: varchar("full_name", { length: 200 }).notNull(),
  birthDate: date("birth_date").notNull(),
  occupation: varchar("occupation", { length: 160 }),
  bio: varchar("bio", { length: 300 }),
  phone: varchar("phone", { length: 30 }),
  instagram: varchar("instagram", { length: 255 }),
  facebook: varchar("facebook", { length: 255 }),
  identityStatus: mysqlEnum("identity_status", verificationStatuses)
    .notNull()
    .default("unverified"),
  identityVerifiedAt: timestamp("identity_verified_at", { fsp: 6 }),
  createdAt: timestamp("created_at", { fsp: 6 }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .onUpdateNow(),
});

export const profilePhotos = mysqlTable(
  "profile_photos",
  {
    id: char("id", { length: 36 })
      .primaryKey()
      .notNull()
      .default(sql`(UUID())`),
    userId: char("user_id", { length: 36 })
      .notNull()
      .references(() => profileProfiles.userId, { onDelete: "cascade" }),
    url: text("url").notNull(),
    position: smallint("position", { unsigned: true }).notNull(),
    createdAt: timestamp("created_at", { fsp: 6 }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_profile_photo_position").on(table.userId, table.position),
    check("chk_profile_photo_position", sql`${table.position} BETWEEN 1 AND 6`),
  ],
);

export const profileContactPrivacy = mysqlTable("profile_contact_privacy", {
  userId: char("user_id", { length: 36 })
    .primaryKey()
    .notNull()
    .references(() => profileProfiles.userId, { onDelete: "cascade" }),
  showPhoneToConnections: boolean("show_phone_to_connections")
    .notNull()
    .default(true),
  showEmailToConnections: boolean("show_email_to_connections")
    .notNull()
    .default(true),
  showSocialsToConnections: boolean("show_socials_to_connections")
    .notNull()
    .default(true),
});

export const profileHousingPreferences = mysqlTable(
  "profile_housing_preferences",
  {
    userId: char("user_id", { length: 36 })
      .primaryKey()
      .notNull()
      .references(() => profileProfiles.userId, { onDelete: "cascade" }),
    seeking: mysqlEnum("seeking", seekingTypes).notNull().default("both"),
    budgetMin: decimal("budget_min", { precision: 10, scale: 2 }),
    budgetMax: decimal("budget_max", { precision: 10, scale: 2 }),
    desiredZoneId: char("desired_zone_id", { length: 36 }).references(
      () => geoZones.id,
    ),
    moveInDate: date("move_in_date"),
    minAgePref: smallint("min_age_pref", { unsigned: true }),
    maxAgePref: smallint("max_age_pref", { unsigned: true }),
  },
  (table) => [
    check(
      "chk_profile_budget_min",
      sql`${table.budgetMin} IS NULL OR ${table.budgetMin} >= 0`,
    ),
    check(
      "chk_profile_budget_max",
      sql`${table.budgetMax} IS NULL OR ${table.budgetMax} >= 0`,
    ),
    check(
      "chk_profile_budget_range",
      sql`${table.budgetMax} IS NULL OR ${table.budgetMin} IS NULL OR ${table.budgetMax} >= ${table.budgetMin}`,
    ),
    check(
      "chk_profile_min_age",
      sql`${table.minAgePref} IS NULL OR ${table.minAgePref} >= 18`,
    ),
    check(
      "chk_profile_age_range",
      sql`${table.maxAgePref} IS NULL OR ${table.minAgePref} IS NULL OR ${table.maxAgePref} >= ${table.minAgePref}`,
    ),
  ],
);

// Tipos generados automáticamente por Drizzle ORM
export type ProfileRow = typeof profileProfiles.$inferSelect;
export type NewProfile = typeof profileProfiles.$inferInsert;

export type ProfilePhotoRow = typeof profilePhotos.$inferSelect;
export type NewProfilePhoto = typeof profilePhotos.$inferInsert;

export type ProfileContactPrivacyRow = typeof profileContactPrivacy.$inferSelect;
export type NewProfileContactPrivacy = typeof profileContactPrivacy.$inferInsert;

export type ProfileHousingPreferenceRow = typeof profileHousingPreferences.$inferSelect;
export type NewProfileHousingPreference = typeof profileHousingPreferences.$inferInsert;

