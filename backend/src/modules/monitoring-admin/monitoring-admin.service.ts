import { AppError } from "../../shared/AppError.js";
import { longestFailedProbeRun } from "../../monitoring/metrics.js";
import { monthWindow } from "../../monitoring/time.js";
import {
  TEST_SUITES,
  ProcessTestRunExecutor,
  type TestRunExecutor,
  type TestSuiteDefinition,
} from "../../monitoring/testRunner.js";
import type { MonitoringIngestService } from "../monitoring/monitoring.service.js";
import type { MonitoringAdminRepository, TestRunRow } from "./monitoring-admin.ports.js";

export interface SliPanelRow {
  sliId: string;
  module: string;
  method: string;
  sliValue: number | null;
  sloValue: number | null;
  margin: number | null;
  state: "met" | "unmet" | "no-data";
  totalTx: number;
  goodTx: number;
  used3mWindow: boolean;
  message: string;
}

export interface SummaryResponse {
  period: string;
  availability: {
    value: number | null;
    slo: number | null;
    compliant: boolean | null;
    message: string;
  };
  outage: {
    minutes: number | null;
    limitMinutes: number | null;
    compliant: boolean | null;
    message: string;
  };
  sloMet: { met: number | null; total: number };
  transactions: { good: number; bad: number; serverErrors: number };
  lastTestRun: {
    id: string;
    finishedAt: string;
    suite: string;
    complete: boolean;
    passedTests: number;
    totalTests: number;
  } | null;
  lastBackup: { date: string; status: string } | null;
}

export interface TestRunSummary {
  id: string;
  startedAt: string;
  finishedAt: string;
  suite: string;
  complete: boolean;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  source: string;
}

export interface TestResultPanelRow {
  sliId: string | null;
  module: string;
  testName: string;
  result: string;
  durationMs: number | null;
  message: string;
  dataSummary?: string | null;
  expected?: string | null;
  obtained?: string | null;
}

export interface LogbookResponse {
  items: Array<{
    id: string;
    occurredAt: string;
    occurredAtLocal: string;
    type: string;
    module: string;
    operation: string;
    status: string;
    durationMs: number | null;
    message: string;
    source: string;
    requestId: string | null;
    sliId: string | null;
    excluded: boolean;
  }>;
  nextCursor: string | null;
}

export interface TestExecutionResponse {
  suite: string;
  runId: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  queued: number;
  message: string;
}

type Query = Record<string, string | undefined>;

const CURRENT_PERIOD = (): string =>
  new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString().slice(0, 7);

const noData = (subject: string): string => `sin dato: no hay mediciones de ${subject} en el periodo.`;

/** "YYYY-MM" -> primer día del mes siguiente, para filtrar respaldos por fecha. */
const nextMonthFirst = (period: string): string => {
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(5, 7));
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
};

export class MonitoringAdminService {
  private runningSuite: string | null = null;

  constructor(
    private readonly repository: MonitoringAdminRepository,
    private readonly testRunner: TestRunExecutor = new ProcessTestRunExecutor(),
    private readonly ingest: MonitoringIngestService | null = null,
  ) {}

  /** Cualquier fallo de la base de monitoreo se vuelve un 503 controlado. */
  private async read<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        "La base de monitoreo no responde. El resto de la aplicación sigue funcionando.",
        503,
        "MONITOR_DB_UNAVAILABLE",
      );
    }
  }

  private period(raw: string | undefined): string {
    const period = raw?.trim() || CURRENT_PERIOD();
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
      throw new AppError("Indica el mes como YYYY-MM.", 400, "PERIOD_INVALID");
    }
    monthWindow(period);
    return period;
  }

  private window(period: string): { start: Date; end: Date } {
    return monthWindow(period);
  }

  private instant(value: string | undefined, edge: "start" | "end"): Date {
    if (!value) throw new AppError("from y to son obligatorios.", 400, "RANGE_INVALID");
    const time =
      /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? `${value}T${edge === "start" ? "00:00:00.000" : "23:59:59.999"}Z`
        : value;
    const date = new Date(time);
    if (Number.isNaN(date.getTime())) {
      throw new AppError("Las fechas deben estar en formato ISO.", 400, "RANGE_INVALID");
    }
    return date;
  }

  summary = async (query: Query): Promise<SummaryResponse> => {
    const period = this.period(query.month);
    const { start, end } = this.window(period);

    const [compliance, catalog, probes, requests, lastRun, lastBackup] = await Promise.all([
      this.read(() => this.repository.getCompliance(period)),
      this.read(() => this.repository.getCatalog()),
      this.read(() => this.repository.getProbes(start, end)),
      this.read(() => this.repository.getRequests(start, end)),
      this.read(() => this.repository.getLastRun(start, end)),
      this.read(() => this.repository.getLastBackup(`${period}-01`, nextMonthFirst(period))),
    ]);

    const t1 = compliance.find((row) => row.sliId === "T.1");
    const t2 = compliance.find((row) => row.sliId === "T.2");
    const outageRun = longestFailedProbeRun(
      probes.map((row) => ({ checkedAt: row.checkedAt, ok: row.status === "up" })),
    );
    const realRequests = requests.filter((row) => row.source === "real");

    return {
      period,
      availability: {
        value: t1?.sliValue === null || t1 === undefined ? null : Number(t1.sliValue),
        slo: t1?.sloValue == null ? null : Number(t1.sloValue),
        compliant: t1?.compliant == null ? null : t1.compliant === 1,
        message: t1?.message ?? noData("T.1"),
      },
      outage: {
        minutes: probes.length === 0 ? null : outageRun.count,
        limitMinutes:
          catalog.find((row) => row.sliId === "T.2")?.thresholdMs == null
            ? null
            : (catalog.find((row) => row.sliId === "T.2")!.thresholdMs ?? 0) / 60_000,
        compliant: t2?.compliant == null ? null : t2.compliant === 1,
        message: t2?.message ?? noData("T.2"),
      },
      sloMet: {
        met: compliance.length === 0 ? null : compliance.filter((row) => row.compliant === 1).length,
        total: catalog.length,
      },
      transactions: {
        good: realRequests.filter((row) => row.isGood === 1).length,
        bad: realRequests.filter((row) => row.isGood !== 1).length,
        serverErrors: realRequests.filter((row) => row.status >= 500).length,
      },
      lastTestRun: lastRun
        ? {
            id: lastRun.id,
            finishedAt: lastRun.finishedAt.toISOString(),
            suite: lastRun.suite,
            complete: lastRun.complete === 1,
            passedTests: lastRun.passedTests,
            totalTests: lastRun.totalTests,
          }
        : null,
      lastBackup: lastBackup
        ? { date: lastBackup.backupDate, status: lastBackup.status }
        : null,
    };
  };

  slis = async (query: Query): Promise<{ period: string; items: SliPanelRow[] }> => {
    const period = this.period(query.month);
    const [compliance, catalog] = await Promise.all([
      this.read(() => this.repository.getCompliance(period)),
      this.read(() => this.repository.getCatalog()),
    ]);
    const byId = new Map(compliance.map((row) => [row.sliId, row]));
    const items = catalog.map((row): SliPanelRow => {
      const snapshot = byId.get(row.sliId);
      const value = snapshot?.sliValue == null ? null : Number(snapshot.sliValue);
      const slo = snapshot?.sloValue == null ? null : Number(snapshot.sloValue);
      return {
        sliId: row.sliId,
        module: row.module,
        method: row.method,
        sliValue: value,
        sloValue: slo,
        margin: value === null || slo === null ? null : Math.round((value - slo) * 10) / 10,
        state: snapshot?.compliant == null ? "no-data" : snapshot.compliant === 1 ? "met" : "unmet",
        totalTx: snapshot?.totalTx ?? 0,
        goodTx: snapshot?.goodTx ?? 0,
        used3mWindow: snapshot?.used3mWindow === 1,
        message: snapshot?.message ?? noData(row.sliId),
      };
    });
    return { period, items };
  };

  runs = async (query: Query): Promise<{ items: TestRunSummary[]; nextCursor: string | null }> => {
    const rawLimit = Number(query.limit ?? 20);
    if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 50) {
      throw new AppError("limit debe estar entre 1 y 50.", 400, "LIMIT_INVALID");
    }
    let before: Date | undefined;
    if (query.cursor) {
      const parts = query.cursor.split("|");
      const parsed = new Date(parts[0] ?? "");
      if (parts.length !== 2 || Number.isNaN(parsed.getTime())) {
        throw new AppError("Cursor de corridas inválido.", 400, "CURSOR_INVALID");
      }
      before = parsed;
    }
    const rows = await this.read(() => this.repository.getRuns(rawLimit + 1, before));
    const hasMore = rows.length > rawLimit;
    const items = rows.slice(0, rawLimit).map((row) => this.runDto(row));
    const last = items.at(-1);
    return {
      items,
      nextCursor: hasMore && last ? `${last.finishedAt}|${last.id}` : null,
    };
  };

  run = async (id: string): Promise<{ run: TestRunSummary; results: TestResultPanelRow[] }> => {
    if (!/^[A-Za-z0-9_-]{1,36}$/.test(id)) {
      throw new AppError("Identificador de corrida inválido.", 400, "RUN_ID_INVALID");
    }
    const [row, results] = await Promise.all([
      this.read(() => this.repository.getRun(id)),
      this.read(() => this.repository.getResults(id)),
    ]);
    if (!row) throw new AppError("No existe esa corrida de pruebas.", 404, "RUN_NOT_FOUND");
    return {
      run: this.runDto(row),
      results: results.map((result) => ({
        sliId: result.sliId,
        module: result.module,
        testName: result.testName,
        result: result.result,
        durationMs: result.durationMs,
        message: result.message,
        dataSummary: result.dataSummary ?? null,
        expected: result.expected ?? null,
        obtained: result.obtained ?? null,
      })),
    };
  };

  logbook = async (query: Query): Promise<LogbookResponse> => {
    const period = this.period(query.month);
    const fallback = this.window(period);
    const from = query.from ? this.instant(query.from, "start") : fallback.start;
    const to = query.to ? this.instant(query.to, "end") : new Date(fallback.end.getTime() - 1);
    if (from > to || to.getTime() - from.getTime() > 366 * 86_400_000) {
      throw new AppError("El rango debe ser válido y no superar un año.", 400, "RANGE_INVALID");
    }
    const allowedTypes = new Set(["request", "business", "probe", "test", "incident", "backup"]);
    if (query.type && !allowedTypes.has(query.type)) {
      throw new AppError("Tipo de evento desconocido.", 400, "TYPE_INVALID");
    }
    const limit = Number(query.limit ?? 50);
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      throw new AppError("limit debe estar entre 1 y 50.", 400, "LIMIT_INVALID");
    }
    const rows = await this.read(() =>
      this.repository.getLogbook({
        from,
        to,
        module: query.module?.trim() || undefined,
        type: query.type,
        status: query.status,
        inSliOnly: query.inSli === "true" || query.inSli === "1",
        includeExcluded: query.includeExcluded === "true" || query.includeExcluded === "1",
        onlyOperations:
          query.scope === "operations" && (!query.type || query.type === "business"),
        cursor: query.cursor,
        limit: limit + 1,
      }),
    );
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map((row) => ({
      id: row.id,
      occurredAt: row.occurredAt.toISOString(),
      occurredAtLocal: row.occurredAtLocal.toISOString(),
      type: row.type,
      module: row.module,
      operation: row.operation,
      status: row.statusLabel,
      durationMs: row.durationMs,
      message: row.message,
      source: row.source,
      requestId: row.requestId,
      sliId: row.sliId,
      excluded: row.excluded === 1,
    }));
    const last = items.at(-1);
    return {
      items,
      nextCursor: hasMore && last ? `${last.occurredAt}|${last.id}` : null,
    };
  };

  exportRequests = async (
    period: string | undefined,
  ): Promise<{ period: string; rows: Awaited<ReturnType<MonitoringAdminRepository["getRequestExport"]>> }> => {
    const resolved = this.period(period);
    const { start, end } = this.window(resolved);
    const rows = await this.read(() => this.repository.getRequestExport(start, end));
    return { period: resolved, rows };
  };

  suites = (): TestSuiteDefinition[] => TEST_SUITES.map((item) => ({ ...item }));

  /** Ejecuta una suite permitida; solo encola el resultado, nunca espera a la base. */
  executeTests = async (suite: string): Promise<TestExecutionResponse> => {
    const id = suite?.trim() ?? "";
    if (!TEST_SUITES.some((item) => item.id === id)) {
      throw new AppError("Suite no permitida. Consulta las suites disponibles.", 400, "SUITE_INVALID");
    }
    if (this.runningSuite) {
      throw new AppError("Ya hay una corrida en curso. Espera a que termine.", 409, "TEST_RUN_BUSY");
    }
    if (!this.ingest) {
      throw new AppError("La ingesta de resultados no está disponible.", 503, "MONITOR_INGEST_UNAVAILABLE");
    }

    this.runningSuite = id;
    try {
      const outcome = await this.testRunner.run(id);
      const accepted = this.ingest.ingestTestRun(outcome);
      if (!accepted.accepted) {
        throw new AppError(accepted.error, accepted.status === 503 ? 503 : 400, accepted.code);
      }
      return {
        suite: id,
        runId: outcome.run.id,
        totalTests: outcome.run.totalTests,
        passedTests: outcome.run.passedTests,
        failedTests: outcome.run.failedTests,
        queued: accepted.queued,
        message: `Corrida ${id} encolada: ${outcome.run.passedTests} de ${outcome.run.totalTests} pruebas pasaron.`,
      };
    } finally {
      this.runningSuite = null;
    }
  };

  private runDto(row: TestRunRow): TestRunSummary {
    return {
      id: row.id,
      startedAt: row.startedAt.toISOString(),
      finishedAt: row.finishedAt.toISOString(),
      suite: row.suite,
      complete: row.complete === 1,
      totalTests: row.totalTests,
      passedTests: row.passedTests,
      failedTests: row.failedTests,
      source: row.source,
    };
  }
}
