import { monthWindow } from "./time.js";

/** Regla fija del plan: 90 días, nunca configurable por comando. */
export const RETENTION_DAYS = 90;

export interface RetentionWindow {
  start: Date;
  end: Date;
}

export interface PeriodPlan {
  period: string;
  monthEnd: string;
  snapshot: boolean;
  csv: boolean;
  oldEnough: boolean;
  action: "delete" | "keep";
  reason: string;
}

export interface RetentionPlan {
  generatedAt: string;
  retentionDays: number;
  cutoff: string;
  periods: PeriodPlan[];
}

export interface RetentionDeletion {
  table: string;
  rows: number;
}

export interface RetentionStore {
  listSnapshotPeriods(): Promise<string[]>;
  deletePeriod(period: string, window: RetentionWindow): Promise<RetentionDeletion[]>;
}

export interface RetentionOptions {
  store: RetentionStore;
  csvReady: (period: string) => boolean;
  apply?: boolean;
  now?: Date;
}

/**
 * Decide qué meses se pueden borrar. Un mes solo sale de la base de
 * monitoreo si tiene foto en `mon_slo_compliance`, CSV exportado y ya
 * cumplió los 90 días. Lo demás se conserva y se explica en `reason`.
 */
export function planRetention(options: {
  snapshotPeriods: string[];
  csvReady: (period: string) => boolean;
  now?: Date;
}): RetentionPlan {
  const now = options.now ?? new Date();
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 86_400_000);
  const snapshot = new Set(options.snapshotPeriods);
  const periods = [...snapshot].sort().map((period): PeriodPlan => {
    const { end } = monthWindow(period);
    const hasSnapshot = snapshot.has(period);
    const hasCsv = options.csvReady(period);
    const oldEnough = end.getTime() <= cutoff.getTime();
    const canDelete = hasSnapshot && hasCsv && oldEnough;
    let reason = "Tiene foto mensual, CSV y 90 días cumplidos; se puede borrar.";
    if (!hasSnapshot) reason = "Sin foto en mon_slo_compliance; se conserva.";
    else if (!hasCsv) reason = "Sin CSV exportado; se conserva.";
    else if (!oldEnough) reason = "Aún no cumple 90 días; se conserva.";
    return {
      period,
      monthEnd: end.toISOString(),
      snapshot: hasSnapshot,
      csv: hasCsv,
      oldEnough,
      action: canDelete ? "delete" : "keep",
      reason,
    };
  });
  return {
    generatedAt: now.toISOString(),
    retentionDays: RETENTION_DAYS,
    cutoff: cutoff.toISOString(),
    periods,
  };
}

export async function runRetention(
  options: RetentionOptions,
): Promise<{
  plan: RetentionPlan;
  deleted: Array<{ period: string; tables: RetentionDeletion[] }>;
}> {
  const snapshotPeriods = await options.store.listSnapshotPeriods();
  const plan = planRetention({
    snapshotPeriods,
    csvReady: options.csvReady,
    now: options.now ?? new Date(),
  });
  const deleted: Array<{ period: string; tables: RetentionDeletion[] }> = [];
  if (options.apply) {
    for (const entry of plan.periods.filter((period) => period.action === "delete")) {
      deleted.push({
        period: entry.period,
        tables: await options.store.deletePeriod(entry.period, monthWindow(entry.period)),
      });
    }
  }
  return { plan, deleted };
}
