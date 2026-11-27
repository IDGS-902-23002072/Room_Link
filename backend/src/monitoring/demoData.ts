import { isGoodTransaction } from "./metrics.js";
import type {
  monActivityLog,
  monBackupLog,
  monCaseEvent,
  monError,
  monIncident,
  monProbe,
  monRequestLog,
  monTestResult,
  monTestRun,
} from "./schema.js";
import { SLI_CATALOG } from "./sliCatalog.js";
import { addBusinessHours, monthWindow } from "./time.js";

type Insert<T> = T extends { $inferInsert: infer I } ? I : never;

export type DemoRequest = Insert<typeof monRequestLog>;
export type DemoError = Insert<typeof monError>;
export type DemoActivity = Insert<typeof monActivityLog>;
export type DemoProbe = Insert<typeof monProbe>;
export type DemoBackup = Insert<typeof monBackupLog>;
export type DemoRun = Insert<typeof monTestRun>;
export type DemoResult = Insert<typeof monTestResult>;
export type DemoCase = Insert<typeof monCaseEvent>;
export type DemoIncident = Insert<typeof monIncident>;

export interface DemoData {
  requests: DemoRequest[];
  errors: DemoError[];
  activities: DemoActivity[];
  probes: DemoProbe[];
  backups: DemoBackup[];
  run: DemoRun;
  results: DemoResult[];
  cases: DemoCase[];
  incidents: DemoIncident[];
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function hash(text: string): number {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function randomFrom(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

/** Id estable de 36 caracteres para que repetir la demo no duplique filas. */
function demoId(period: string, serial: number): string {
  const first = hash(`${period}:${serial}`).toString(16).padStart(8, "0");
  const second = hash(`${period}:b:${serial}`).toString(16).padStart(8, "0");
  return `${first}-${second.slice(0, 4)}-4000-8000-${second.slice(4)}${serial
    .toString(16)
    .padStart(4, "0")}`;
}

const at = (start: Date, day: number, hour: number, minute = 0): Date =>
  new Date(start.getTime() + day * DAY + hour * HOUR + minute * 60_000);

/** Fecha local de León (UTC-6) para la columna `backup_date`. */
const localDate = (instant: Date): string =>
  new Date(instant.getTime() - 6 * HOUR).toISOString().slice(0, 10);

/**
 * Construye un mes simulado. Todo viaja con source `synthetic` o `test`: el
 * cálculo del SLA sigue usando solo `real`, así que la demo muestra "sin dato"
 * en las transacciones y no contamina los indicadores verdaderos.
 */
export function buildDemoData(period: string): DemoData {
  const { start, end } = monthWindow(period);
  const days = Math.round((end.getTime() - start.getTime()) / DAY);
  const random = randomFrom(hash(period));

  const requests: DemoRequest[] = [];
  const txSlis = SLI_CATALOG.filter(
    (sli) => sli.method === "F1" && sli.thresholdMs !== null && sli.routePattern,
  );
  for (const sli of txSlis) {
    const threshold = sli.thresholdMs!;
    const route = sli.routePattern!.replace(/^`/, "");
    for (let index = 0; index < 40; index += 1) {
      const moduleNumber = Number.parseInt(sli.id, 10) || 16;
      const occurredAt = at(start, (index * 7 + moduleNumber) % days, index % 24, (index * 13) % 60);
      const isBad = index % 20 === 19;
      // Los 4xx dentro del umbral cuentan como buenos, según el SLA.
      const status = isBad ? 500 : index % 7 === 0 ? 404 : 200;
      const durationMs = isBad
        ? threshold + 150
        : 80 + Math.floor(random() * Math.max(1, Math.min(1000, threshold - 80)));
      requests.push({
        occurredAt,
        method: index % 3 === 0 ? "POST" : "GET",
        routePattern: route,
        status,
        durationMs,
        role: index % 2 === 0 ? "seeker" : "host",
        requestId: `demo-req-${sli.id}-${String(index).padStart(3, "0")}`,
        sliId: sli.id,
        isGood: isGoodTransaction(status, durationMs, threshold) ? 1 : 0,
        source: "synthetic",
      });
    }
  }

  const probes: DemoProbe[] = [];
  for (let day = 0; day < days; day += 1) {
    for (let minute = 0; minute < 60; minute += 1) {
      // Una caída corta de 8 minutos permite demostrar T.2 sin exceder 12 h.
      const down = day === 2 && minute >= 10 && minute < 18;
      probes.push({
        checkedAt: at(start, day, 0, minute),
        status: down ? "down" : "up",
        httpStatus: down ? 503 : 200,
        latencyMs: down ? null : 20 + Math.floor(random() * 100),
        source: "synthetic",
        requestId: `demo-probe-${day}-${String(minute).padStart(2, "0")}`,
        message: down
          ? "Sondeo simulado: /ready respondió 503"
          : "Sondeo simulado de /ready correcto",
      });
    }
  }

  const backups: DemoBackup[] = [];
  for (let day = 0; day < days; day += 1) {
    const recordedAt = at(start, day, 23, 30);
    backups.push({
      backupDate: localDate(recordedAt),
      status: "success",
      sizeBytes: 12_000_000 + day * 1024,
      durationMs: 4_000 + day * 10,
      source: "synthetic",
      recordedAt,
      message: `Respaldo simulado del ${localDate(recordedAt)}`,
    });
  }

  const errors: DemoError[] = requests
    .filter((row) => row.status >= 500)
    .slice(0, 24)
    .map((row) => ({
      occurredAt: row.occurredAt,
      module: "PLAT",
      code: "DEMO_SERVER_ERROR",
      message: "Error 500 simulado para la demostración",
      status: row.status,
      requestId: row.requestId,
      source: "synthetic",
    }));

  const activities: DemoActivity[] = Array.from({ length: 30 }, (_, index) => ({
    occurredAt: at(start, index % days, 9 + (index % 8), (index * 11) % 60),
    module: `M${(index % 15) + 1}`,
    action: `Demo: operación simulada ${index + 1}`,
    result: "success",
    message: "Operación simulada para la demostración, sin datos personales",
    httpStatus: 200,
    durationMs: 100 + Math.floor(random() * 800),
    requestId: `demo-activity-${String(index).padStart(3, "0")}`,
    source: "synthetic",
    sliId: SLI_CATALOG.filter((sli) => sli.type === "test")[index % 15]?.id ?? null,
    detail: {},
  }));

  const ruleSlis = SLI_CATALOG.filter((sli) => sli.type === "test");
  const runId = demoId(period, 0);
  const run: DemoRun = {
    id: runId,
    startedAt: at(start, days - 1, 8),
    finishedAt: at(start, days - 1, 8, 5),
    suite: "backend:unit (demo)",
    complete: 1,
    totalTests: ruleSlis.length,
    passedTests: ruleSlis.length - 1,
    failedTests: 1,
    commitSha: `demo-${period}`,
    source: "test",
    message: "Corrida completa simulada para la demostración",
  };
  const results: DemoResult[] = ruleSlis.map((sli, index) => ({
    runId,
    occurredAt: at(start, days - 1, 8, index),
    sliId: sli.id,
    module: sli.module.slice(0, 48),
    testName: `[SLI ${sli.id}] regla simulada de la demo`,
    result: index === ruleSlis.length - 1 ? "failed" : "passed",
    dataSummary: "Datos sintéticos sin información personal",
    expected: "Cumple la regla del SLA",
    obtained: index === ruleSlis.length - 1 ? "Resultado simulado distinto" : "Resultado simulado esperado",
    durationMs: 10 + index,
    source: "test",
    message: `Resultado simulado para ${sli.id}`,
  }));

  const cases: DemoCase[] = SLI_CATALOG.filter((sli) => sli.type === "case").flatMap((sli) => {
    const threshold = sli.thresholdMs ?? Number.MAX_SAFE_INTEGER;
    return Array.from({ length: 40 }, (_, index) => {
      const elapsedMs = index % 10 === 9 ? threshold + 1000 : Math.floor(threshold * 0.4);
      const startedAt = at(start, index % 20, 8 + (index % 6));
      return {
        sliId: sli.id,
        caseKey: demoId(`${period}-case-${sli.id}`, index),
        startedAt,
        finishedAt: new Date(startedAt.getTime() + elapsedMs),
        elapsedMs,
        onTime: elapsedMs <= threshold ? 1 : 0,
      };
    });
  });

  const priorities = ["P0", "P1", "P2", "P3", "P1", "P2"] as const;
  const hours = { P0: 4, P1: 9, P2: 18, P3: 45 } as const;
  const modules = ["PLAT", "M13", "M14", "M10", "M12", "M11"];
  const incidents: DemoIncident[] = priorities.map((priority, index) => {
    const openedAt = at(start, 3 + index * 4, 15);
    const firstResponseDueAt = addBusinessHours(openedAt, hours[priority]);
    const late = index === 4;
    const firstResponseAt = new Date(
      firstResponseDueAt.getTime() + (late ? 60 : -30) * 60_000,
    );
    const restoredAt = new Date(firstResponseDueAt.getTime() + 2 * HOUR);
    return {
      githubIssue: 900_000 + index,
      priority,
      module: modules[index]!,
      openedAt,
      firstResponseAt,
      restoredAt,
      closedAt: new Date(restoredAt.getTime() + HOUR),
      firstResponseDueAt,
    };
  });

  return { requests, errors, activities, probes, backups, run, results, cases, incidents };
}
