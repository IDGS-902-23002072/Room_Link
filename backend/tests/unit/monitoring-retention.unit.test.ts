import { describe, expect, it } from "vitest";
import {
  planRetention,
  RETENTION_DAYS,
  runRetention,
  type RetentionStore,
} from "../../src/monitoring/retention.js";
import { monthWindow } from "../../src/monitoring/time.js";

const NOW = new Date("2026-11-27T12:00:00Z");
const csvReady = (period: string): boolean => period !== "2026-03";

describe("F7 · retención de 90 días", () => {
  it("solo borra meses con foto, CSV y 90 días cumplidos", () => {
    const plan = planRetention({
      snapshotPeriods: ["2026-01", "2026-03", "2026-08", "2026-09"],
      csvReady,
      now: NOW,
    });
    expect(plan.retentionDays).toBe(90);
    expect(plan.cutoff).toBe("2026-08-29T12:00:00.000Z");
    expect(plan.periods.map((row) => [row.period, row.action])).toEqual([
      ["2026-01", "delete"],
      ["2026-03", "keep"],
      ["2026-08", "keep"],
      ["2026-09", "keep"],
    ]);
    expect(plan.periods.find((row) => row.period === "2026-03")?.reason).toContain("CSV");
    expect(plan.periods.find((row) => row.period === "2026-01")?.snapshot).toBe(true);
  });

  it("acepta el límite exacto de 90 días sobre el cierre del mes", () => {
    const end = monthWindow("2026-05").end;
    const now = new Date(end.getTime() + RETENTION_DAYS * 86_400_000);
    const plan = planRetention({ snapshotPeriods: ["2026-05"], csvReady: () => true, now });
    expect(plan.periods[0]?.oldEnough).toBe(true);
    expect(plan.periods[0]?.action).toBe("delete");
  });

  it("no elimina nada en seco y respeta la foto en modo aplicado", async () => {
    const deleted: string[] = [];
    const store: RetentionStore = {
      listSnapshotPeriods: async () => ["2026-01", "2026-03"],
      deletePeriod: async (period) => {
        deleted.push(period);
        return [{ table: "mon_request_log", rows: 10 }];
      },
    };
    const dry = await runRetention({ store, csvReady, now: NOW });
    expect(dry.deleted).toEqual([]);

    const applied = await runRetention({ store, csvReady, apply: true, now: NOW });
    expect(deleted).toEqual(["2026-01"]);
    expect(applied.deleted).toEqual([
      { period: "2026-01", tables: [{ table: "mon_request_log", rows: 10 }] },
    ]);
  });
});
