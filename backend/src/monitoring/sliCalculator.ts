import { and, desc, eq, gte, lt } from "drizzle-orm";
import { monitorDb } from "./db.js";
import {
  monBackupLog,
  monCaseEvent,
  monExclusion,
  monIncident,
  monProbe,
  monRequestLog,
  monSloCompliance,
  monTestResult,
  monTestRun,
} from "./schema.js";
import {
  buildMetric,
  isGoodTransaction,
  longestFailedProbeRun,
  type Metric,
} from "./metrics.js";
import { SLI_CATALOG, SLI_BY_ID, type SliDefinition } from "./sliCatalog.js";
import { monthWindow } from "./time.js";

interface Counts {
  total: number;
  good: number;
}

export interface SloSnapshot {
  sliId: string;
  period: string;
  totalTx: number;
  goodTx: number;
  sliValue: string | null;
  sloValue: string | null;
  compliant: number | null;
  message: string;
}

export async function calculateMonthlySlo(period: string): Promise<SloSnapshot[]> {
  const current = monthWindow(period, 1);
  const threeMonths = monthWindow(period, 3);
  const exclusions = await monitorDb.select().from(monExclusion);
  const excludedRequestIds = new Set(
    exclusions.filter((row) => row.kind === "request_id").map((row) => row.value),
  );
  const excludedRoutes = new Set(
    exclusions.filter((row) => row.kind === "route_pattern").map((row) => row.value),
  );

  const requestRows = (await monitorDb
    .select()
    .from(monRequestLog)
    .where(
      and(
        gte(monRequestLog.occurredAt, current.start),
        lt(monRequestLog.occurredAt, current.end),
        eq(monRequestLog.source, "real"),
      ),
    )
  ).filter(
    (row) =>
      !excludedRequestIds.has(row.requestId ?? "") &&
      !excludedRoutes.has(row.routePattern),
  );

  const caseRows = await monitorDb
    .select()
    .from(monCaseEvent)
    .where(and(gte(monCaseEvent.startedAt, current.start), lt(monCaseEvent.startedAt, current.end)));

  // Las reglas usan solo la ÚLTIMA corrida completa del mes (sección 7 del plan).
  const latestRuns = await monitorDb
    .select({ id: monTestRun.id })
    .from(monTestRun)
    .where(
      and(
        gte(monTestRun.finishedAt, current.start),
        lt(monTestRun.finishedAt, current.end),
        eq(monTestRun.complete, 1),
      ),
    )
    .orderBy(desc(monTestRun.finishedAt))
    .limit(1);
  const latestRunId = latestRuns[0]?.id ?? null;
  const testRows =
    latestRunId === null
      ? []
      : await monitorDb
          .select({ sliId: monTestResult.sliId, result: monTestResult.result })
          .from(monTestResult)
          .where(eq(monTestResult.runId, latestRunId));

  const probeRows = await monitorDb
    .select()
    .from(monProbe)
    .where(and(gte(monProbe.checkedAt, current.start), lt(monProbe.checkedAt, current.end)));

  const backupRows = await monitorDb
    .select()
    .from(monBackupLog)
    .where(and(gte(monBackupLog.backupDate, `${period}-01`), lt(monBackupLog.backupDate, nextMonthFirst(period))));

  const incidentRows = await monitorDb
    .select()
    .from(monIncident)
    .where(and(gte(monIncident.openedAt, current.start), lt(monIncident.openedAt, current.end)));

  const snapshots: SloSnapshot[] = [];

  for (const sli of SLI_CATALOG) {
    let metric: Metric;

    if (sli.id === "T.2") {
      const run = longestFailedProbeRun(
        probeRows.map((row) => ({ checkedAt: row.checkedAt, ok: row.status === "up" })),
      );
      const compliant =
        probeRows.length === 0 ? null : run.durationMs <= (sli.thresholdMs ?? 0);
      metric = {
        total: probeRows.length,
        good: probeRows.length - run.count,
        value: null,
        compliant,
        message:
          probeRows.length === 0
            ? "sin dato: no hay sondeos de /ready en el mes."
            : `La racha más larga de sondeos fallidos fue de ${run.count} minutos (${run.durationMs} ms) frente al límite de ${sli.thresholdMs} ms; ${compliant ? "cumple" : "no cumple"}.`,
      };
    } else if (sli.id === "T.4") {
      const daysInMonth = Number(new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0)).getUTCDate());
      const good = backupRows.filter((row) => row.status === "success").length;
      metric = buildMetric(good, daysInMonth, sli.sloPercent, "Días con respaldo exitoso");
    } else if (sli.id === "T.5") {
      const good = incidentRows.filter(
        (row) => row.firstResponseAt !== null && row.firstResponseAt <= row.firstResponseDueAt,
      ).length;
      metric = buildMetric(good, incidentRows.length, sli.sloPercent, "Incidentes respondidos en plazo");
    } else if (sli.id === "T.6") {
      metric = buildMetric(0, 0, sli.sloPercent, "Reportes mensuales entregados");
    } else if (sli.type === "platform" && sli.id === "T.1") {
      metric = buildMetric(
        probeRows.filter((row) => row.status === "up").length,
        probeRows.length,
        sli.sloPercent,
        "Sondeos de /ready correctos",
      );
    } else if (sli.type === "test") {
      const rows = testRows.filter((row) => row.sliId === sli.id);
      metric = buildMetric(
        rows.filter((row) => row.result === "passed").length,
        rows.length,
        sli.sloPercent,
        `Pruebas de ${sli.id}`,
      );
    } else if (sli.type === "case") {
      const rows = caseRows.filter((row) => row.sliId === sli.id);
      const counts = {
        total: rows.length,
        good: rows.filter((row) => row.elapsedMs !== null && row.elapsedMs <= (sli.thresholdMs ?? Number.MAX_SAFE_INTEGER)).length,
      };
      const fallback = counts.total < 30 ? await countCaseFallback(sli.id, threeMonths.start, current.end) : counts;
      metric = buildMetric(fallback.good, fallback.total, sli.sloPercent, `Casos de ${sli.id}`);
    } else if (sli.method === "F1" && sli.thresholdMs !== null) {
      const rows = requestRows.filter((row) => row.sliId === sli.id);
      const counts = {
        total: rows.length,
        good: rows.filter((row) => isGoodTransaction(row.status, row.durationMs, sli.thresholdMs!)).length,
      };
      const fallback = counts.total < 30
        ? await countRequestFallback(sli.id, sli.thresholdMs, threeMonths.start, current.end, excludedRequestIds, excludedRoutes)
        : counts;
      metric = buildMetric(fallback.good, fallback.total, sli.sloPercent, `Transacciones de ${sli.id}`);
    } else {
      metric = buildMetric(0, 0, sli.sloPercent, `Medición de ${sli.id}`);
    }

    snapshots.push({
      sliId: sli.id,
      period,
      totalTx: metric.total,
      goodTx: metric.good,
      sliValue: metric.value === null ? null : metric.value.toFixed(1),
      sloValue: sli.sloPercent === null ? null : sli.sloPercent.toFixed(1),
      compliant: metric.compliant === null ? null : metric.compliant ? 1 : 0,
      message: metric.message,
    });
  }

  await monitorDb.delete(monSloCompliance).where(eq(monSloCompliance.period, period));
  if (snapshots.length > 0) {
    await monitorDb.insert(monSloCompliance).values(snapshots);
  }
  return snapshots;
}

const nextMonthFirst = (period: string): string => {
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(5, 7));
  const date = new Date(Date.UTC(year, month, 1));
  return date.toISOString().slice(0, 10);
};

async function countRequestFallback(
  sliId: string,
  thresholdMs: number,
  start: Date,
  end: Date,
  excludedRequestIds: Set<string>,
  excludedRoutes: Set<string>,
): Promise<Counts> {
  const rows = (
    await monitorDb
      .select()
      .from(monRequestLog)
      .where(
        and(
          gte(monRequestLog.occurredAt, start),
          lt(monRequestLog.occurredAt, end),
          eq(monRequestLog.source, "real"),
          eq(monRequestLog.sliId, sliId),
        ),
      )
  ).filter(
    (row) =>
      !excludedRequestIds.has(row.requestId ?? "") &&
      !excludedRoutes.has(row.routePattern),
  );
  return {
    total: rows.length,
    good: rows.filter((row) => isGoodTransaction(row.status, row.durationMs, thresholdMs)).length,
  };
}

async function countCaseFallback(sliId: string, start: Date, end: Date): Promise<Counts> {
  const sli = SLI_BY_ID.get(sliId);
  const rows = await monitorDb
    .select()
    .from(monCaseEvent)
    .where(
      and(
        eq(monCaseEvent.sliId, sliId),
        gte(monCaseEvent.startedAt, start),
        lt(monCaseEvent.startedAt, end),
      ),
    );
  return {
    total: rows.length,
    good: rows.filter(
      (row) => row.elapsedMs !== null && row.elapsedMs <= (sli?.thresholdMs ?? Number.MAX_SAFE_INTEGER),
    ).length,
  };
}


export const sliDefinitions: SliDefinition[] = SLI_CATALOG;
