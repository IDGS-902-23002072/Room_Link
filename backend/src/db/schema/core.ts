import { sql } from "drizzle-orm";
import {
  bigint,
  char,
  index,
  json,
  mysqlTable,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const coreOutboxEvents = mysqlTable(
  "core_outbox_events",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .autoincrement()
      .primaryKey(),
    eventType: varchar("event_type", { length: 120 }).notNull(),
    aggregateId: char("aggregate_id", { length: 36 }),
    payload: json("payload")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`(JSON_OBJECT())`),
    createdAt: timestamp("created_at", { fsp: 6 }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { fsp: 6 }),
  },
  (table) => [index("idx_outbox_pending").on(table.processedAt, table.id)],
);

// Tipos generados automáticamente por Drizzle ORM
export type CoreOutboxEventRow = typeof coreOutboxEvents.$inferSelect;
export type NewCoreOutboxEvent = typeof coreOutboxEvents.$inferInsert;

