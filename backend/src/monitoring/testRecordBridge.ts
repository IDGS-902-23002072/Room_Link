import { UUID_HEADER } from "./requestLogger.js";
import type { MonitorRecord } from "./writer.js";

/**
 * Puente seguro entre la suite que corre en un proceso aparte y la ingesta del
 * panel. La suite escribe en stdout solo líneas marcadas; el proceso padre lee
 * esas líneas y vuelve a sanitizarlas antes de encolarlas en `roomlink_monitor`.
 * Nunca se envía cuerpo de petición, correo, token, IP ni URL con id.
 */
export const TEST_RECORD_ENV = "ROOMLINK_EMIT_MONITOR_RECORDS";
const RECORD_EVENT = "monitor_record";

/** Solo estos tres tipos pueden venir de una suite. */
export type TestMonitorRecord =
  | Extract<MonitorRecord, { kind: "request" }>
  | Extract<MonitorRecord, { kind: "activity" }>
  | Extract<MonitorRecord, { kind: "probe" }>;

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const IPV4 = /(?:\d{1,3}\.){3}\d{1,3}/;
const LONG_SECRET = /[A-Za-z0-9_-]{24,}/;
const URL_WITH_ID = /\/api\/v1\/\S+\/(?:\d+|[0-9a-f]{8}-[0-9a-f-]{27,})/i;
const SLI_ID = /^\d{1,2}\.\d{1,2}$|^T\.\d{1,2}$/;
const ROUTE = /^\/[A-Za-z0-9_/:.\-]*$/;
const ROLE = /^[a-z_]{1,32}$/i;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Igual criterio que la ingesta: descarta texto con datos personales o secretos. */
export const safeShortText = (value: unknown, maxLength: number): string | null => {
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
};

const asId = (value: unknown): string | null =>
  typeof value === "string" && UUID_HEADER.test(value) ? value : null;

const asInt = (value: unknown, min: number, max: number): number | null =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max
    ? value
    : null;

const asDate = (value: unknown): Date | null => {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const asSliId = (value: unknown): string | null =>
  typeof value === "string" && SLI_ID.test(value) ? value : null;

const asRoute = (value: unknown): string | null => {
  const text = safeShortText(value, 200);
  return text && ROUTE.test(text) ? text : null;
};

/** Lo llama la suite; si no hay bandera, no ensucia la salida normal de Vitest. */
export const emitTestRecord = (record: MonitorRecord): void => {
  if (process.env[TEST_RECORD_ENV] !== "1") return;
  process.stdout.write(
    `${JSON.stringify({ origin: "monitoring", event: RECORD_EVENT, record })}\n`,
  );
};

/** Convierte una línea del proceso hijo en un registro permitido, o lo descarta. */
export const sanitizeTestRecord = (raw: unknown): TestMonitorRecord | null => {
  if (!isRecord(raw)) return null;
  const now = new Date();

  if (raw.kind === "activity") {
    const value = raw.value;
    if (!isRecord(value)) return null;
    const module = safeShortText(value.module, 48);
    const action = safeShortText(value.action, 160);
    const message = safeShortText(value.message, 300);
    const result =
      value.result === "success" || value.result === "rejected" || value.result === "failed"
        ? value.result
        : null;
    if (!module || !action || !message || !result) return null;
    return {
      kind: "activity",
      value: {
        module,
        action,
        result,
        message,
        httpStatus: asInt(value.httpStatus, 100, 599),
        durationMs: asInt(value.durationMs, 0, 3_600_000),
        requestId: asId(value.requestId),
        sliId: asSliId(value.sliId),
        actorId: null,
        source: "test",
        occurredAt: asDate(value.occurredAt) ?? now,
        detail: {},
      },
    };
  }

  if (raw.kind === "request") {
    const value = raw.value;
    if (!isRecord(value)) return null;
    const method = safeShortText(value.method, 10);
    const routePattern = asRoute(value.routePattern);
    const status = asInt(value.status, 100, 599);
    const durationMs = asInt(value.durationMs, 0, 3_600_000);
    const message = safeShortText(value.message, 200) ?? "";
    const role = safeShortText(value.role, 32);
    const isGood = value.isGood === 1 || value.isGood === true ? 1 : value.isGood === 0 ? 0 : null;
    if (!method || !/^[A-Z]{3,10}$/.test(method) || !routePattern || status === null || durationMs === null || isGood === null) {
      return null;
    }
    return {
      kind: "request",
      value: {
        method,
        routePattern,
        status,
        durationMs,
        role: role && ROLE.test(role) ? role : null,
        requestId: asId(value.requestId),
        sliId: asSliId(value.sliId),
        isGood,
        source: "test",
        message,
        occurredAt: asDate(value.occurredAt) ?? now,
      },
    };
  }

  if (raw.kind === "probe") {
    const value = raw.value;
    if (!isRecord(value)) return null;
    const status = value.status === "up" || value.status === "down" ? value.status : null;
    const message = safeShortText(value.message, 300);
    if (!status || !message) return null;
    return {
      kind: "probe",
      value: {
        status,
        httpStatus: asInt(value.httpStatus, 100, 599),
        latencyMs: asInt(value.latencyMs, 0, 3_600_000),
        requestId: asId(value.requestId),
        source: "test",
        message,
        checkedAt: asDate(value.checkedAt) ?? now,
      },
    };
  }

  return null;
};

/** Solo lee líneas con el marcador propio; el resto de la salida se ignora. */
export const parseTestRecords = (stdout: string): TestMonitorRecord[] => {
  const records: TestMonitorRecord[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.includes(`"event":"${RECORD_EVENT}"`)) continue;
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      if (parsed.origin !== "monitoring" || parsed.event !== RECORD_EVENT) continue;
      const safe = sanitizeTestRecord(parsed.record);
      if (safe) records.push(safe);
    } catch {
      // Una línea ajena no debe romper la corrida.
    }
  }
  return records;
};
