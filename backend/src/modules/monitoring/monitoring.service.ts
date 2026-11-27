import { timingSafeEqual } from "node:crypto";
import { BatchedMonitorWriter } from "../../monitoring/writer.js";

export type IngestOutcome =
  | { accepted: true; queued: number; message: string }
  | { accepted: false; status: 400 | 401 | 413 | 503; code: string; error: string };

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const IPV4 = /(?:\d{1,3}\.){3}\d{1,3}/;
const LONG_SECRET = /[A-Za-z0-9_-]{24,}/;
const URL_WITH_ID = /\/api\/v1\/\S+\/(?:\d+|[0-9a-f]{8}-[0-9a-f-]{27,})/i;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Nunca guarda correos, IPs, tokens ni URLs con identificadores. */
export function safeText(value: unknown, maxLength = 300): string | null {
  if (typeof value !== "string") return null;
  if (
    EMAIL.test(value) ||
    IPV4.test(value) ||
    LONG_SECRET.test(value) ||
    URL_WITH_ID.test(value) ||
    /(?:bearer\s|token\s*[=:]|password\s*[=:]|contraseña\s*[=:])/i.test(value)
  ) {
    return null;
  }
  return value.slice(0, maxLength);
}

const asDate = (value: unknown): Date | null => {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const asNonNegativeInt = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) return null;
  return value;
};

const reject = (
  status: 400 | 401 | 413 | 503,
  code: string,
  error: string,
): Extract<IngestOutcome, { accepted: false }> => ({ accepted: false, status, code, error });

export class MonitoringIngestService {
  constructor(
    private readonly writer: BatchedMonitorWriter,
    private readonly ingestToken: string,
  ) {}

  hasToken(token: string | undefined): boolean {
    if (!this.ingestToken || !token) return false;
    const expected = Buffer.from(this.ingestToken, "utf8");
    const received = Buffer.from(token, "utf8");
    return expected.length === received.length && timingSafeEqual(expected, received);
  }

  parseBody(raw: string, maxBytes: number): unknown | IngestOutcome {
    if (Buffer.byteLength(raw, "utf8") > maxBytes) {
      return reject(413, "INGEST_TOO_LARGE", "El cuerpo de la ingesta es demasiado grande.");
    }
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return reject(400, "INGEST_INVALID_JSON", "El cuerpo debe ser JSON válido.");
    }
  }

  ingestProbe(payload: unknown): IngestOutcome {
    if (!isRecord(payload)) return reject(400, "PROBE_INVALID", "El sondeo debe ser un objeto.");
    const status = payload.status === "up" ? "up" : payload.status === "down" ? "down" : null;
    const httpStatus = asNonNegativeInt(payload.httpStatus);
    const latencyMs = asNonNegativeInt(payload.latencyMs);
    const checkedAt = asDate(payload.checkedAt) ?? new Date();
    const requestId = typeof payload.requestId === "string" && UUID.test(payload.requestId)
      ? payload.requestId
      : null;
    if (!status) return reject(400, "PROBE_INVALID", "El estado del sondeo debe ser 'up' o 'down'.");

    this.writer.enqueue({
      kind: "probe",
      value: {
        checkedAt,
        status,
        httpStatus,
        latencyMs,
        requestId,
        source: "synthetic",
        message:
          status === "up"
            ? "El sondeo de /ready respondió correctamente dentro del periodo de muestreo."
            : "El sondeo de /ready no respondió correctamente; la plataforma quedó marcada como no disponible.",
      },
    });

    return {
      accepted: true,
      queued: 1,
      message: "Sondeo encolado para su escritura en roomlink_monitor.",
    };
  }

  ingestBackup(payload: unknown): IngestOutcome {
    if (!isRecord(payload)) return reject(400, "BACKUP_INVALID", "El respaldo debe ser un objeto.");
    const backupDate =
      typeof payload.backupDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(payload.backupDate)
        ? payload.backupDate
        : null;
    const status = payload.status === "success" ? "success" : payload.status === "failed" ? "failed" : null;
    const sizeBytes = asNonNegativeInt(payload.sizeBytes);
    const durationMs = asNonNegativeInt(payload.durationMs);
    if (!backupDate || !status) {
      return reject(400, "BACKUP_INVALID", "Se requieren backupDate (YYYY-MM-DD) y status (success o failed).");
    }

    this.writer.enqueue({
      kind: "backup",
      value: {
        backupDate,
        status,
        sizeBytes,
        durationMs,
        source: "synthetic",
        recordedAt: new Date(),
        message:
          status === "success"
            ? `Se registró el respaldo diario del ${backupDate} como completado.`
            : `Se registró el respaldo diario del ${backupDate} como fallido.`,
      },
    });

    return {
      accepted: true,
      queued: 1,
      message: "Respaldo encolado para su escritura en roomlink_monitor.",
    };
  }

  ingestTestRun(payload: unknown): IngestOutcome {
    if (!isRecord(payload)) return reject(400, "TEST_RUN_INVALID", "La corrida debe ser un objeto.");
    const run = payload.run;
    if (!isRecord(run)) return reject(400, "TEST_RUN_INVALID", "Falta el objeto 'run'.");

    const id = typeof run.id === "string" && UUID.test(run.id) ? run.id : null;
    const startedAt = asDate(run.startedAt);
    const finishedAt = asDate(run.finishedAt);
    const suite = safeText(run.suite, 80);
    const totalTests = asNonNegativeInt(run.totalTests);
    const passedTests = asNonNegativeInt(run.passedTests);
    const failedTests = asNonNegativeInt(run.failedTests);
    if (
      !id ||
      !startedAt ||
      !finishedAt ||
      !suite ||
      totalTests === null ||
      passedTests === null ||
      failedTests === null
    ) {
      return reject(400, "TEST_RUN_INVALID", "La corrida requiere id UUID, fechas, suite y conteos enteros.");
    }

    const rawResults = payload.results;
    if (!Array.isArray(rawResults)) {
      return reject(400, "TEST_RUN_INVALID", "Se requiere un arreglo 'results'.");
    }

    const results: Array<{
      sliId: string | null;
      module: string;
      testName: string;
      result: string;
      dataSummary: string | null;
      expected: string | null;
      obtained: string | null;
      durationMs: number | null;
      source: "test";
      occurredAt: Date;
      runId: string;
      message: string;
    }> = [];

    for (const raw of rawResults) {
      if (!isRecord(raw)) continue;
      const module = safeText(raw.module, 48);
      const testName = safeText(raw.testName, 300);
      const description = safeText(raw.description, 300);
      const result =
        raw.result === "passed" || raw.result === "failed" || raw.result === "skipped"
          ? raw.result
          : null;
      if (!module || !testName || !result) continue;

      const sliId =
        typeof raw.sliId === "string" && /^\d{1,2}\.\d{1,2}$|^T\.\d{1,2}$/.test(raw.sliId)
          ? raw.sliId
          : null;
      const durationMs = asNonNegativeInt(raw.durationMs);
      const dataSummary = safeText(raw.dataSummary, 300);
      const expected = safeText(raw.expected, 300);
      const obtained = safeText(raw.obtained, 300);
      results.push({
        runId: id,
        occurredAt: finishedAt,
        sliId,
        module,
        testName,
        result,
        dataSummary,
        expected,
        obtained,
        durationMs,
        source: "test",
        message: `${description ?? `Se verificó ${testName}.`} Resultado: ${result}.`,
      });
    }

    this.writer.enqueue({
      kind: "testRun",
      value: {
        id,
        startedAt,
        finishedAt,
        suite: suite.slice(0, 80),
        complete: run.complete === true ? 1 : 0,
        totalTests,
        passedTests,
        failedTests,
        commitSha: safeText(run.commitSha, 64),
        source: "test",
        message: `Corrida ${suite}: ${passedTests} pruebas pasaron y ${failedTests} fallaron de ${totalTests}; ${run.complete === true ? "completa" : "parcial"}.`,
      },
    });
    for (const result of results) this.writer.enqueue({ kind: "testResult", value: result });

    return {
      accepted: true,
      queued: 1 + results.length,
      message: `Corrida encolada con ${results.length} resultados de prueba.`,
    };
  }
}
