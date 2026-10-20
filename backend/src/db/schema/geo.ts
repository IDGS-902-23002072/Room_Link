import { sql } from "drizzle-orm";
import {
  char,
  check,
  decimal,
  index,
  mysqlTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const geoZones = mysqlTable(
  "geo_zones",
  {
    id: char("id", { length: 36 })
      .primaryKey()
      .notNull()
      .default(sql`(UUID())`),
    name: varchar("name", { length: 160 }).notNull(),
    city: varchar("city", { length: 160 }).notNull(),
    state: varchar("state", { length: 160 }).notNull().default("Guanajuato"),
  },
  (table) => [
    uniqueIndex("uq_geo_zone_name_city_state").on(
      table.name,
      table.city,
      table.state,
    ),
  ],
);

export const geoLocations = mysqlTable(
  "geo_locations",
  {
    id: char("id", { length: 36 })
      .primaryKey()
      .notNull()
      .default(sql`(UUID())`),
    zoneId: char("zone_id", { length: 36 }).references(() => geoZones.id),
    address: varchar("address", { length: 500 }).notNull(),
    postalCode: varchar("postal_code", { length: 20 }),
    latitude: decimal("latitude", { precision: 9, scale: 6 }).notNull(),
    longitude: decimal("longitude", { precision: 9, scale: 6 }).notNull(),
    createdAt: timestamp("created_at", { fsp: 6 }).notNull().defaultNow(),
  },
  (table) => [
    check("chk_geo_latitude", sql`${table.latitude} BETWEEN -90 AND 90`),
    check("chk_geo_longitude", sql`${table.longitude} BETWEEN -180 AND 180`),
    index("idx_geo_locations_coords").on(table.latitude, table.longitude),
    index("idx_geo_locations_zone").on(table.zoneId),
  ],
);

export const geoPointsOfInterest = mysqlTable(
  "geo_points_of_interest",
  {
    id: char("id", { length: 36 })
      .primaryKey()
      .notNull()
      .default(sql`(UUID())`),
    name: varchar("name", { length: 200 }).notNull(),
    category: varchar("category", { length: 100 }).notNull(),
    latitude: decimal("latitude", { precision: 9, scale: 6 }).notNull(),
    longitude: decimal("longitude", { precision: 9, scale: 6 }).notNull(),
  },
  (table) => [
    check("chk_geo_poi_latitude", sql`${table.latitude} BETWEEN -90 AND 90`),
    check("chk_geo_poi_longitude", sql`${table.longitude} BETWEEN -180 AND 180`),
    index("idx_geo_poi_coords").on(table.latitude, table.longitude),
  ],
);
