import { createHash } from "node:crypto";
import mysql, { type RowDataPacket } from "mysql2/promise";
import { eq } from "drizzle-orm";
import { config } from "../config.js";
import { monitorDb } from "./db.js";
import { monCaseEvent } from "./schema.js";
import { SLI_BY_ID } from "./sliCatalog.js";
import { monthWindow } from "./time.js";

/** Pool de SOLO LECTURA sobre la base principal: nunca ejecuta INSERT/UPDATE. */
export const readOnlyPool = mysql.createPool({
  host: config.database.host,
  port: config.database.port,
  user: config.monitor.readOnlyUser,
  password: config.monitor.readOnlyPassword,
  database: config.monitor.readOnlyDatabase,
  connectionLimit: 1,
  timezone: "Z",
});

interface CaseRow extends RowDataPacket {
  case_id: string | number;
  started_at: Date;
  finished_at: Date | null;
}

const QUERIES = [
  {
    sliId: "10.4",
    sql: "SELECT id AS case_id, sent_at AS started_at, delivered_at AS finished_at FROM chat_messages WHERE sent_at >= ? AND sent_at < ? AND delivered_at IS NOT NULL",
  },
  {
    sliId: "13.4",
    sql: "SELECT id AS case_id, created_at AS started_at, resolved_at AS finished_at FROM mod_reports WHERE created_at >= ? AND created_at < ? AND resolved_at IS NOT NULL",
  },
  {
    sliId: "14.3",
    sql: "SELECT id AS case_id, created_at AS started_at, email_sent_at AS finished_at FROM notif_notifications WHERE created_at >= ? AND created_at < ? AND email_sent_at IS NOT NULL",
  },
] as const;

/** Identificador opaco: nunca se guarda el id original ni ningún dato personal. */
export const opaqueCaseKey = (id: string | number): string =>
  createHash("sha256").update(String(id)).digest("hex").slice(0, 36);

/** Copia casos medidos a `roomlink_monitor`; la base principal solo se lee. */
export async function collectCaseEvents(period: string): Promise<number> {
  const { start, end } = monthWindow(period);
  let inserted = 0;

  for (const query of QUERIES) {
    const thresholdMs = SLI_BY_ID.get(query.sliId)?.thresholdMs ?? null;
    const [rows] = await readOnlyPool.query<CaseRow[]>(query.sql, [start, end]);
    const existingRows = await monitorDb
      .select({ caseKey: monCaseEvent.caseKey })
      .from(monCaseEvent)
      .where(eq(monCaseEvent.sliId, query.sliId));
    const existing = new Set(existingRows.map((row) => row.caseKey));
    const values = rows
      .map((row) => {
        const caseKey = opaqueCaseKey(row.case_id);
        if (existing.has(caseKey) || !row.finished_at) return null;
        const elapsedMs = Math.max(0, row.finished_at.getTime() - row.started_at.getTime());
        return {
          sliId: query.sliId,
          caseKey,
          startedAt: row.started_at,
          finishedAt: row.finished_at,
          elapsedMs,
          onTime: thresholdMs === null ? null : elapsedMs <= thresholdMs ? 1 : 0,
        };
      })
      .filter((value): value is NonNullable<typeof value> => value !== null);

    if (values.length > 0) {
      await monitorDb.insert(monCaseEvent).values(values);
      inserted += values.length;
    }
  }

  return inserted;
}

export const closeReadOnlyPool = async (): Promise<void> => {
  await readOnlyPool.end();
};
