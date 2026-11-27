import { describe, expect, it } from "vitest";
import { buildDemoData } from "../../src/monitoring/demoData.js";
import { isGoodTransaction, longestFailedProbeRun } from "../../src/monitoring/metrics.js";
import { SLI_CATALOG } from "../../src/monitoring/sliCatalog.js";
import { monthWindow } from "../../src/monitoring/time.js";

const PERIOD = "2026-10";
const data = buildDemoData(PERIOD);
const { start, end } = monthWindow(PERIOD);
const inside = (date: Date): boolean =>
  date.getTime() >= start.getTime() && date.getTime() < end.getTime();

describe("F7 · mes simulado", () => {
  it("genera el mismo mes cada vez y solo con fuentes separadas de lo real", () => {
    expect(JSON.stringify(buildDemoData(PERIOD))).toBe(JSON.stringify(data));
    const sources = [
      ...data.requests,
      ...data.errors,
      ...data.activities,
      ...data.probes,
      ...data.backups,
    ].map((row) => row.source);
    expect(new Set(sources)).toEqual(new Set(["synthetic"]));
    expect([data.run.source, ...data.results.map((row) => row.source)]).toEqual(
      expect.arrayContaining(["test"]),
    );
  });

  it("no guarda correos, credenciales, IPs ni URLs con identificadores", () => {
    const text = JSON.stringify(data);
    expect(text).not.toMatch(/@|Bearer|password|contraseña|token|1\.1\.1\.1|https?:\/\//i);
  });

  it("deja al menos 30 transacciones por SLI F1 y marca bien los buenos", () => {
    const txSlis = SLI_CATALOG.filter(
      (sli) => sli.method === "F1" && sli.thresholdMs !== null && sli.routePattern,
    );
    expect(data.requests).toHaveLength(txSlis.length * 40);
    for (const sli of txSlis) {
      const rows = data.requests.filter((row) => row.sliId === sli.id);
      expect(rows).toHaveLength(40);
      for (const row of rows) {
        expect(inside(row.occurredAt!)).toBe(true);
        expect(row.isGood).toBe(
          isGoodTransaction(row.status, row.durationMs, sli.thresholdMs!) ? 1 : 0,
        );
      }
      expect(rows.some((row) => row.status === 404 && row.isGood === 1)).toBe(true);
      expect(rows.some((row) => row.status >= 500 && row.isGood === 0)).toBe(true);
    }
  });

  it("produce 60 sondeos por día y una racha fallida de 8 minutos", () => {
    const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
    expect(data.probes).toHaveLength(days * 60);
    for (const probe of data.probes) expect(inside(probe.checkedAt!)).toBe(true);
    const run = longestFailedProbeRun(
      data.probes.map((row) => ({ checkedAt: row.checkedAt!, ok: row.status === "up" })),
    );
    expect(run.count).toBe(8);
    expect(run.durationMs).toBe(8 * 60_000);
  });

  it("registra un respaldo por día y una corrida completa de pruebas", () => {
    const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
    expect(data.backups).toHaveLength(days);
    for (const backup of data.backups) {
      expect(backup.backupDate.startsWith(PERIOD)).toBe(true);
      expect(backup.status).toBe("success");
    }
    const rules = SLI_CATALOG.filter((sli) => sli.type === "test");
    expect(data.run.complete).toBe(1);
    expect(data.run.totalTests).toBe(rules.length);
    expect(data.run.passedTests).toBe(rules.length - 1);
    expect(data.results).toHaveLength(rules.length);
    expect(data.results.filter((row) => row.result === "passed")).toHaveLength(rules.length - 1);
    expect(data.results.every((row) => row.runId === data.run.id)).toBe(true);
  });

  it("llena casos F4 con su umbral real e incidentes con plazos T.5", () => {
    for (const sli of SLI_CATALOG.filter((row) => row.type === "case")) {
      const rows = data.cases.filter((row) => row.sliId === sli.id);
      expect(rows).toHaveLength(40);
      for (const row of rows) {
        expect(row.onTime).toBe(row.elapsedMs! <= sli.thresholdMs! ? 1 : 0);
      }
    }
    expect(new Set(data.incidents.map((row) => row.githubIssue)).size).toBe(data.incidents.length);
    for (const incident of data.incidents) {
      expect(incident.firstResponseDueAt.getTime()).toBeGreaterThan(incident.openedAt.getTime());
      expect(inside(incident.openedAt)).toBe(true);
    }
    expect(data.incidents.some((row) => row.firstResponseAt! > row.firstResponseDueAt)).toBe(true);
  });
});
