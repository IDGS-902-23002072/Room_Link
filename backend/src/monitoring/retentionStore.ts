import { and, gte, inArray, lt } from "drizzle-orm";
import { monitorDb } from "./db.js";
import type { RetentionDeletion, RetentionStore } from "./retention.js";
import {
  monActivityLog,
  monBackupLog,
  monCaseEvent,
  monError,
  monIncident,
  monProbe,
  monRequestLog,
  monSloCompliance,
  monTestResult,
  monTestRun,
} from "./schema.js";

const HOUR = 3_600_000;

const affectedRows = (result: unknown): number =>
  typeof result === "object" && result !== null && "affectedRows" in result
    ? Number((result as { affectedRows: number }).affectedRows)
    : 0;

/**
 * Borra solo eventos crudos del mes indicado. Nunca toca
 * `mon_slo_compliance`, `mon_sli_catalog` ni `mon_exclusion`: la foto y el
 * catálogo son la evidencia que permite repetir el cálculo.
 */
export const createMonitorRetentionStore = (): RetentionStore => ({
  listSnapshotPeriods: async () => {
    const rows = await monitorDb
      .selectDistinct({ period: monSloCompliance.period })
      .from(monSloCompliance);
    return rows.map((row) => row.period).sort();
  },

  deletePeriod: async (period, window) => {
    const { start, end } = window;
    const nextDay = new Date(end.getTime() - 6 * HOUR).toISOString().slice(0, 10);
    const deletions: RetentionDeletion[] = [];
    const remove = async (table: string, operation: () => Promise<unknown>): Promise<void> => {
      deletions.push({ table, rows: affectedRows(await operation()) });
    };

    await remove("mon_request_log", () =>
      monitorDb
        .delete(monRequestLog)
        .where(and(gte(monRequestLog.occurredAt, start), lt(monRequestLog.occurredAt, end))),
    );
    await remove("mon_error", () =>
      monitorDb
        .delete(monError)
        .where(and(gte(monError.occurredAt, start), lt(monError.occurredAt, end))),
    );
    await remove("mon_activity_log", () =>
      monitorDb
        .delete(monActivityLog)
        .where(and(gte(monActivityLog.occurredAt, start), lt(monActivityLog.occurredAt, end))),
    );
    await remove("mon_probe", () =>
      monitorDb
        .delete(monProbe)
        .where(and(gte(monProbe.checkedAt, start), lt(monProbe.checkedAt, end))),
    );
    await remove("mon_backup_log", () =>
      monitorDb
        .delete(monBackupLog)
        .where(
          and(
            gte(monBackupLog.backupDate, `${period}-01`),
            lt(monBackupLog.backupDate, nextDay),
          ),
        ),
    );
    await remove("mon_case_event", () =>
      monitorDb
        .delete(monCaseEvent)
        .where(and(gte(monCaseEvent.startedAt, start), lt(monCaseEvent.startedAt, end))),
    );
    await remove("mon_incident", () =>
      monitorDb
        .delete(monIncident)
        .where(and(gte(monIncident.openedAt, start), lt(monIncident.openedAt, end))),
    );

    const runs = await monitorDb
      .select({ id: monTestRun.id })
      .from(monTestRun)
      .where(and(gte(monTestRun.finishedAt, start), lt(monTestRun.finishedAt, end)));
    const runIds = runs.map((row) => row.id);
    if (runIds.length > 0) {
      await remove("mon_test_result", () =>
        monitorDb.delete(monTestResult).where(inArray(monTestResult.runId, runIds)),
      );
      await remove("mon_test_run", () =>
        monitorDb.delete(monTestRun).where(inArray(monTestRun.id, runIds)),
      );
    }
    return deletions;
  },
});
