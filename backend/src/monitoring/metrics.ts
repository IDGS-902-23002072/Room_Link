/**
 * Fórmulas del SLA, sin acceso a base de datos. Todo se calcula con enteros y
 * se trunca a un decimal; nunca se redondea.
 */

export interface Metric {
  total: number;
  good: number;
  value: number | null;
  compliant: boolean | null;
  message: string;
}

/** floor(good*1000/total)/10. Devuelve null cuando no hay medición. */
export function truncatePercent(good: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.floor((good * 1000) / total) / 10;
}

/** good*100 >= slo*total, con enteros (slo se recibe con un decimal). */
export function meetsSlo(good: number, total: number, sloPercent: number): boolean | null {
  if (total <= 0) return null;
  return good * 1000 >= Math.round(sloPercent * 10) * total;
}

/** Una transacción es buena si no es 5xx y está dentro del umbral; un 4xx sí lo es. */
export function isGoodTransaction(
  status: number,
  durationMs: number,
  thresholdMs: number,
): boolean {
  return status < 500 && durationMs <= thresholdMs;
}

/** P95 con el rango más cercano: ⌈0.95 × n⌉ sobre la lista ordenada. */
export function percentile95(sortedValuesMs: number[]): number | null {
  if (sortedValuesMs.length === 0) return null;
  const rank = Math.ceil(0.95 * sortedValuesMs.length);
  return sortedValuesMs[Math.max(0, rank - 1)] ?? null;
}

/** Promedio informativo: el SLA lo pide solo como referencia, no como SLO. */
export function average(valuesMs: number[]): number | null {
  if (valuesMs.length === 0) return null;
  return valuesMs.reduce((sum, value) => sum + value, 0) / valuesMs.length;
}

export interface ProbeSample {
  checkedAt: Date;
  ok: boolean;
}

/**
 * Racha más larga de sondeos fallidos consecutivos (T.2). El sondeo corre cada
 * minuto, por eso cada muestra cuenta un minuto.
 */
export function longestFailedProbeRun(samples: ProbeSample[]): {
  count: number;
  durationMs: number;
} {
  const ordered = [...samples].sort((a, b) => a.checkedAt.getTime() - b.checkedAt.getTime());
  let count = 0;
  let longest = 0;
  for (const sample of ordered) {
    if (sample.ok) {
      count = 0;
    } else {
      count += 1;
      longest = Math.max(longest, count);
    }
  }
  return { count: longest, durationMs: longest * 60_000 };
}

/** Construye el resultado de un SLI a partir de buenos y totales. */
export function buildMetric(
  good: number,
  total: number,
  sloPercent: number | null,
  subject: string,
): Metric {
  if (total <= 0) {
    return {
      total: 0,
      good,
      value: null,
      compliant: null,
      message: `sin dato: no hay mediciones de ${subject} en el periodo.`,
    };
  }
  const value = truncatePercent(good, total);
  const compliant = sloPercent === null ? null : meetsSlo(good, total, sloPercent);
  const goal = sloPercent === null ? "sin SLO porcentual" : `objetivo ${sloPercent.toFixed(1)} %`;
  const verdict = compliant === null ? "sin comparación porcentual" : compliant ? "cumple" : "no cumple";
  return {
    total,
    good,
    value,
    compliant,
    message: `${subject}: ${value?.toFixed(1)} % de casos buenos (${good} de ${total}); ${goal}; ${verdict}.`,
  };
}
