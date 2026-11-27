import { sql } from "drizzle-orm";
import { monitorDb } from "./db.js";
import {
  monActivityLog,
  monBackupLog,
  monError,
  monProbe,
  monRequestLog,
  monTestResult,
  monTestRun,
} from "./schema.js";
import { emitMonitorEvent, type MonitorRecord, type MonitorSink } from "./writer.js";

const RETRY_DELAYS_MS = [100, 200, 400] as const;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function withRetries(operation: () => Promise<void>, kind: string): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      await operation();
      return;
    } catch (error) {
      lastError = error;
      if (attempt < RETRY_DELAYS_MS.length) {
        emitMonitorEvent({
          event: "monitor_retry",
          kind,
          attempt: attempt + 1,
          waitMs: RETRY_DELAYS_MS[attempt],
        });
        await sleep(RETRY_DELAYS_MS[attempt] ?? 0);
      }
    }
  }
  throw lastError;
}

const pickRequests = (records: MonitorRecord[]) =>
  records.flatMap((record) => (record.kind === "request" ? [record.value] : []));
const pickActivities = (records: MonitorRecord[]) =>
  records.flatMap((record) => (record.kind === "activity" ? [record.value] : []));
const pickErrors = (records: MonitorRecord[]) =>
  records.flatMap((record) => (record.kind === "error" ? [record.value] : []));
const pickProbes = (records: MonitorRecord[]) =>
  records.flatMap((record) => (record.kind === "probe" ? [record.value] : []));
const pickBackups = (records: MonitorRecord[]) =>
  records.flatMap((record) => (record.kind === "backup" ? [record.value] : []));
const pickTestRuns = (records: MonitorRecord[]) =>
  records.flatMap((record) => (record.kind === "testRun" ? [record.value] : []));
const pickTestResults = (records: MonitorRecord[]) =>
  records.flatMap((record) => (record.kind === "testResult" ? [record.value] : []));

/** Escritor real: siempre contra `roomlink_monitor`, nunca contra `roomlink`. */
export class DrizzleMonitorSink implements MonitorSink {
  async insert(records: MonitorRecord[]): Promise<void> {
    const groups: Array<{ kind: MonitorRecord["kind"]; count: number; write: () => Promise<void> }> = [];

    const requests = pickRequests(records);
    if (requests.length > 0) {
      groups.push({
        kind: "request",
        count: requests.length,
        write: () => withRetries(async () => {
          await monitorDb.insert(monRequestLog).values(requests);
        }, "request"),
      });
    }

    const activities = pickActivities(records);
    if (activities.length > 0) {
      groups.push({
        kind: "activity",
        count: activities.length,
        write: () => withRetries(async () => {
          await monitorDb.insert(monActivityLog).values(activities);
        }, "activity"),
      });
    }

    const errors = pickErrors(records);
    if (errors.length > 0) {
      groups.push({
        kind: "error",
        count: errors.length,
        write: () => withRetries(async () => {
          await monitorDb.insert(monError).values(errors);
        }, "error"),
      });
    }

    const probes = pickProbes(records);
    if (probes.length > 0) {
      groups.push({
        kind: "probe",
        count: probes.length,
        write: () => withRetries(async () => {
          await monitorDb.insert(monProbe).values(probes);
        }, "probe"),
      });
    }

    const backups = pickBackups(records);
    if (backups.length > 0) {
      groups.push({
        kind: "backup",
        count: backups.length,
        write: () => withRetries(async () => {
          await monitorDb.insert(monBackupLog).values(backups);
        }, "backup"),
      });
    }

    const testRuns = pickTestRuns(records);
    if (testRuns.length > 0) {
      groups.push({
        kind: "testRun",
        count: testRuns.length,
        write: () => withRetries(async () => {
          await monitorDb
            .insert(monTestRun)
            .values(testRuns)
            .onDuplicateKeyUpdate({ set: { id: sql`id` } });
        }, "testRun"),
      });
    }

    const testResults = pickTestResults(records);
    if (testResults.length > 0) {
      groups.push({
        kind: "testResult",
        count: testResults.length,
        write: () => withRetries(async () => {
          await monitorDb.insert(monTestResult).values(testResults);
        }, "testResult"),
      });
    }

    // Los grupos se escriben en secuencia: el pool de monitoreo tiene máximo
    // 2 conexiones y la petición original ya terminó.
    for (const group of groups) {
      await group.write();
    }
  }
}
