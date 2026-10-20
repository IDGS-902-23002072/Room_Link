import { sql } from "drizzle-orm";
import {
  boolean,
  char,
  check,
  decimal,
  index,
  json,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  smallint,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { authUsers } from "./auth.js";
import { savedProfileStatuses } from "./enums.js";

export const compatProfiles = mysqlTable(
  "compat_profiles",
  {
    userId: char("user_id", { length: 36 })
      .primaryKey()
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    schedule: smallint("schedule", { unsigned: true }).notNull(),
    cleanliness: smallint("cleanliness", { unsigned: true }).notNull(),
    noise: smallint("noise", { unsigned: true }).notNull(),
    pets: smallint("pets", { unsigned: true }).notNull(),
    smoking: smallint("smoking", { unsigned: true }).notNull(),
    visits: smallint("visits", { unsigned: true }).notNull(),
    genderPref: smallint("gender_pref", { unsigned: true }).notNull(),
    completedAt: timestamp("completed_at", { fsp: 6 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .onUpdateNow(),
  },
  (table) => [
    check("chk_compat_schedule", sql`${table.schedule} BETWEEN 1 AND 5`),
    check(
      "chk_compat_cleanliness",
      sql`${table.cleanliness} BETWEEN 1 AND 5`,
    ),
    check("chk_compat_noise", sql`${table.noise} BETWEEN 1 AND 5`),
    check("chk_compat_pets", sql`${table.pets} BETWEEN 1 AND 5`),
    check("chk_compat_smoking", sql`${table.smoking} BETWEEN 1 AND 5`),
    check("chk_compat_visits", sql`${table.visits} BETWEEN 1 AND 5`),
    check(
      "chk_compat_gender_pref",
      sql`${table.genderPref} BETWEEN 1 AND 5`,
    ),
  ],
);

export const compatDimensionWeights = mysqlTable(
  "compat_dimension_weights",
  {
    dimension: mysqlEnum("dimension", [
      "schedule",
      "cleanliness",
      "noise",
      "pets",
      "smoking",
      "visits",
      "gender_pref",
    ]).primaryKey(),
    weight: decimal("weight", { precision: 4, scale: 2 }).notNull(),
  },
  (table) => [check("chk_compat_weight_positive", sql`${table.weight} > 0`)],
);

export const matchAffinityScores = mysqlTable(
  "match_affinity_scores",
  {
    userA: char("user_a", { length: 36 })
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    userB: char("user_b", { length: 36 })
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    score: decimal("score", { precision: 5, scale: 2 }).notNull(),
    computedAt: timestamp("computed_at", { fsp: 6 }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userA, table.userB] }),
    check("chk_match_distinct_users", sql`${table.userA} <> ${table.userB}`),
    check("chk_match_score", sql`${table.score} BETWEEN 0 AND 100`),
    index("idx_match_feed").on(table.userA, table.score),
  ],
);

export const matchSavedProfiles = mysqlTable(
  "match_saved_profiles",
  {
    userId: char("user_id", { length: 36 })
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    candidateId: char("candidate_id", { length: 36 })
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    status: mysqlEnum("status", savedProfileStatuses).notNull(),
    createdAt: timestamp("created_at", { fsp: 6 }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.candidateId] }),
    check(
      "chk_saved_profile_distinct_users",
      sql`${table.userId} <> ${table.candidateId}`,
    ),
  ],
);

export const searchSavedSearches = mysqlTable(
  "search_saved_searches",
  {
    id: char("id", { length: 36 })
      .primaryKey()
      .notNull()
      .default(sql`(UUID())`),
    userId: char("user_id", { length: 36 })
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    filters: json("filters")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`(JSON_OBJECT())`),
    isFavorite: boolean("is_favorite").notNull().default(false),
    createdAt: timestamp("created_at", { fsp: 6 }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_search_saved_user").on(table.userId),
    uniqueIndex("uq_search_saved_name").on(table.userId, table.name),
  ],
);

// Tipos generados automáticamente por Drizzle ORM
export type CompatProfileRow = typeof compatProfiles.$inferSelect;
export type NewCompatProfile = typeof compatProfiles.$inferInsert;

export type CompatDimensionWeightRow = typeof compatDimensionWeights.$inferSelect;
export type NewCompatDimensionWeight = typeof compatDimensionWeights.$inferInsert;

export type MatchAffinityScoreRow = typeof matchAffinityScores.$inferSelect;
export type NewMatchAffinityScore = typeof matchAffinityScores.$inferInsert;

export type MatchSavedProfileRow = typeof matchSavedProfiles.$inferSelect;
export type NewMatchSavedProfile = typeof matchSavedProfiles.$inferInsert;

export type SearchSavedSearchRow = typeof searchSavedSearches.$inferSelect;
export type NewSearchSavedSearch = typeof searchSavedSearches.$inferInsert;

