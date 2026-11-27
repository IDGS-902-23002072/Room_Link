import { describe, expect, it } from "vitest";
import {
  average,
  buildMetric,
  isGoodTransaction,
  longestFailedProbeRun,
  meetsSlo,
  percentile95,
  truncatePercent,
} from "../../src/monitoring/metrics.js";

describe("Fórmulas del SLA · truncado y cumplimiento", () => {
  it("no redondea: 97.04 % se trunca a 97.0 % y cumple 95 %", () => {
    // Ejemplo del plan: diciembre, 44,640 sondeos, 1,320 fallidos.
    const total = 31 * 1_440;
    const good = total - 1_320;
    expect(total).toBe(44_640);
    expect(good).toBe(43_320);
    expect(truncatePercent(good, total)).toBe(97.0);
    expect(meetsSlo(good, total, 95.0)).toBe(true);
    expect(buildMetric(good, total, 95.0, "Sondeos").message).toContain("97.0 %");
  });

  it("1,100 de 1,240 da 88.7 % y no cumple 90 %", () => {
    expect(truncatePercent(1_100, 1_240)).toBe(88.7);
    expect(meetsSlo(1_100, 1_240, 90.0)).toBe(false);
  });

  it("un 4xx cuenta como buena; un 5xx o pasar el umbral no", () => {
    expect(isGoodTransaction(400, 100, 3_000)).toBe(true);
    expect(isGoodTransaction(200, 3_000, 3_000)).toBe(true);
    expect(isGoodTransaction(503, 100, 3_000)).toBe(false);
    expect(isGoodTransaction(200, 3_001, 3_000)).toBe(false);
  });

  it("18 + 9 + 14 transacciones se acumulan y 37/41 da 90.2 %", () => {
    const total = 18 + 9 + 14;
    expect(total).toBe(41);
    expect(truncatePercent(37, total)).toBe(90.2);
    expect(meetsSlo(37, total, 90.0)).toBe(true);
  });

  it("11 de 12 pruebas da 91.6 % y cumple 90 %", () => {
    expect(truncatePercent(11, 12)).toBe(91.6);
    expect(meetsSlo(11, 12, 90.0)).toBe(true);
  });

  it("34 de 40 reportes da 85.0 % y cumple 80 %", () => {
    expect(truncatePercent(34, 40)).toBe(85.0);
    expect(meetsSlo(34, 40, 80.0)).toBe(true);
  });

  it("468 de 480 postulaciones da 97.5 %", () => {
    expect(truncatePercent(468, 480)).toBe(97.5);
  });

  it("sin transacciones el resultado es 'sin dato', nunca 0 %", () => {
    expect(truncatePercent(0, 0)).toBeNull();
    expect(meetsSlo(0, 0, 90.0)).toBeNull();
    const metric = buildMetric(0, 0, 90.0, "Transacciones");
    expect(metric.value).toBeNull();
    expect(metric.compliant).toBeNull();
    expect(metric.message).toContain("sin dato");
  });
});

describe("P95 informativo del plan", () => {
  const durations = [
    90, 110, 120, 130, 150, 160, 170, 180, 200, 210, 230, 250, 270, 300, 340, 420, 520,
    780, 1900, 3400,
  ];

  it("el rango ⌈0.95 × 20⌉ = 19 da P95 = 1,900 ms", () => {
    expect(percentile95([...durations].sort((a, b) => a - b))).toBe(1_900);
  });

  it("el promedio es 496.5 ms y oculta la petición lenta", () => {
    expect(average(durations)).toBe(496.5);
    const good = durations.filter((value) => value <= 3_000).length;
    expect(good).toBe(19);
    expect(truncatePercent(good, durations.length)).toBe(95.0);
    expect(meetsSlo(good, durations.length, 95.0)).toBe(true);
  });
});

describe("T.2 · interrupción más larga", () => {
  it("480 sondeos fallidos seguidos equivalen a 8 h y cumple 12 h", () => {
    const base = Date.parse("2026-12-01T06:00:00.000Z");
    const samples = Array.from({ length: 480 }, (_, index) => ({
      checkedAt: new Date(base + index * 60_000),
      ok: false,
    }));
    const run = longestFailedProbeRun(samples);
    expect(run.count).toBe(480);
    expect(run.durationMs).toBe(480 * 60_000);
    expect(run.durationMs <= 43_200_000).toBe(true);
  });

  it("una racha de 721 minutos no cumple el límite de 12 h", () => {
    const base = Date.parse("2026-12-01T06:00:00.000Z");
    const samples = Array.from({ length: 721 }, (_, index) => ({
      checkedAt: new Date(base + index * 60_000),
      ok: false,
    }));
    expect(longestFailedProbeRun(samples).durationMs <= 43_200_000).toBe(false);
  });

  it("un sondeo correcto corta la racha", () => {
    const base = Date.parse("2026-12-01T06:00:00.000Z");
    const samples = [
      { checkedAt: new Date(base), ok: false },
      { checkedAt: new Date(base + 60_000), ok: false },
      { checkedAt: new Date(base + 120_000), ok: true },
      { checkedAt: new Date(base + 180_000), ok: false },
    ];
    expect(longestFailedProbeRun(samples).count).toBe(2);
  });
});
