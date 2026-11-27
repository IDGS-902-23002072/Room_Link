import "dotenv/config";
import { and, eq, gte, inArray, like, lt } from "drizzle-orm";
import { resolvePeriod, runStep } from "./cli.js";
import { closeMonitorDatabase, monitorDb } from "./db.js";
import { buildDemoData } from "./demoData.js";
import {
  monActivityLog,
  monBackupLog,
  monCaseEvent,
  monError,
  monIncident,
  monProbe,
  monRequestLog,
  monSliCatalog,
  monTestResult,
  monTestRun,
} from "./schema.js";
import { monthWindow } from "./time.js";

const CHUNK = 250;
const period = resolvePeriod();

async function insertChunks<T>(rows: T[], write: (chunk: T[]) => Promise<unknown>): Promise<number> {
  for (let offset = 0; offset < rows.length; offset += CHUNK) {
    await write(rows.slice(offset, offset + CHUNK));
  }
  return rows.length;
}

await runStep("seed_demo", period, async () => {
  const catalogHead = await monitorDb
    .select({ sliId: monSliCatalog.sliId })
    .from(monSliCatalog)
    .limit(1);
  if (!catalogHead[0]?.sliId) {
    throw new Error("Primero ejecuta npm run db:monitor:seed para cargar el catálogo de 67 SLI.");
  }

  const data = buildDemoData(period);
  const { start, end } = monthWindow(period);
  const nextDay = new Date(end.getTime() - 6 * 3_600_000).toISOString().slice(0, 10);

  // Solo se borran filas de la demo: el tráfico real nunca se toca.
  await monitorDb.delete(monTestResult).where(eq(monTestResult.runId, data.run.id));
  await monitorDb.delete(monTestRun).where(eq(monTestRun.id, data.run.id));
  await monitorDb.delete(monRequestLog).where(
    and(
      gte(monRequestLog.occurredAt, start),
      lt(monRequestLog.occurredAt, end),
      eq(monRequestLog.source, "synthetic"),
      like(monRequestLog.requestId, "demo-req-%"),
    ),
  );
  await monitorDb.delete(monError).where(
    and(
      gte(monError.occurredAt, start),
      lt(monError.occurredAt, end),
      eq(monError.source, "synthetic"),
      like(monError.code, "DEMO_%"),
    ),
  );
  await monitorDb.delete(monActivityLog).where(
    and(
      gte(monActivityLog.occurredAt, start),
      lt(monActivityLog.occurredAt, end),
      eq(monActivityLog.source, "synthetic"),
      like(monActivityLog.action, "Demo:%"),
    ),
  );
  await monitorDb.delete(monProbe).where(
    and(
      gte(monProbe.checkedAt, start),
      lt(monProbe.checkedAt, end),
      eq(monProbe.source, "synthetic"),
      like(monProbe.requestId, "demo-probe-%"),
    ),
  );
  await monitorDb.delete(monBackupLog).where(
    and(
      gte(monBackupLog.backupDate, `${period}-01`),
      lt(monBackupLog.backupDate, nextDay),
      eq(monBackupLog.source, "synthetic"),
    ),
  );
  await monitorDb.delete(monCaseEvent).where(
    inArray(
      monCaseEvent.caseKey,
      data.cases.map((row) => row.caseKey),
    ),
  );
  await monitorDb.delete(monIncident).where(
    and(gte(monIncident.githubIssue, 900_000), lt(monIncident.githubIssue, 1_000_000)),
  );

  let records = 0;
  records += await insertChunks(data.requests, (chunk) => monitorDb.insert(monRequestLog).values(chunk));
  records += await insertChunks(data.probes, (chunk) => monitorDb.insert(monProbe).values(chunk));
  records += await insertChunks(data.backups, (chunk) => monitorDb.insert(monBackupLog).values(chunk));
  records += await insertChunks(data.errors, (chunk) => monitorDb.insert(monError).values(chunk));
  records += await insertChunks(data.activities, (chunk) => monitorDb.insert(monActivityLog).values(chunk));
  await monitorDb.insert(monTestRun).values(data.run);
  records += await insertChunks(data.results, (chunk) => monitorDb.insert(monTestResult).values(chunk));
  records += await insertChunks(data.cases, (chunk) => monitorDb.insert(monCaseEvent).values(chunk));
  records += await insertChunks(data.incidents, (chunk) => monitorDb.insert(monIncident).values(chunk));
  return records;
});

await closeMonitorDatabase();
