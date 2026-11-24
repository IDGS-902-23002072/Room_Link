import type { CorteDiario, MetricaMensual, Periodo } from './api';

export const fechaISO = (date: Date) => date.toISOString().slice(0, 10);

export function periodoRapido(meses: 'mes' | '90', ahora = new Date()): Periodo {
  const inicio = new Date(ahora);
  if (meses === 'mes') inicio.setUTCDate(1);
  else inicio.setUTCDate(inicio.getUTCDate() - 89);
  return { start: fechaISO(inicio), end: fechaISO(ahora) };
}

export function validarPeriodo({ start, end }: Periodo) {
  const fechas = [start, end].map((valor) => new Date(`${valor}T00:00:00Z`));
  if (fechas.some((fecha, i) => Number.isNaN(fecha.getTime()) || fechaISO(fecha) !== [start, end][i])) {
    return 'Escribe fechas válidas con formato AAAA-MM-DD.';
  }
  if (start > end) return 'La fecha inicial debe ser anterior o igual a la final.';
  const inicio = fechas[0]!;
  const anio = inicio.getUTCFullYear() + 1;
  const mes = inicio.getUTCMonth();
  const ultimoDia = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  const limite = new Date(Date.UTC(anio, mes, Math.min(inicio.getUTCDate(), ultimoDia)));
  return end > fechaISO(limite) ? 'El rango puede abarcar hasta 12 meses.' : '';
}

export function resumirCortes(cortes: CorteDiario[], meses: MetricaMensual[]) {
  const porMes = new Map<string, { aceptadas: number; cierres: number }>();
  const afinidades: number[] = [];
  for (const corte of cortes) {
    const mes = corte.metricDate.slice(0, 7);
    const acumulado = porMes.get(mes) ?? { aceptadas: 0, cierres: 0 };
    acumulado.aceptadas += corte.connectionsAccepted;
    acumulado.cierres += corte.listingsClosed;
    porMes.set(mes, acumulado);
    if (corte.avgAffinityScore !== null) afinidades.push(corte.avgAffinityScore);
  }
  const serie = (campo: 'aceptadas' | 'cierres') => meses.map(({ month }) => ({
    month, total: porMes.get(month)?.[campo] ?? null,
  }));
  return {
    afinidad: afinidades.length ? afinidades.reduce((suma, valor) => suma + valor, 0) / afinidades.length : null,
    diasConAfinidad: afinidades.length,
    cierres: cortes.length ? cortes.reduce((suma, corte) => suma + corte.listingsClosed, 0) : null,
    conexionesPorMes: serie('aceptadas'),
    cierresPorMes: serie('cierres'),
    ultimoCorte: cortes.reduce<string | null>((ultimo, corte) => !ultimo || corte.metricDate > ultimo ? corte.metricDate : ultimo, null),
  };
}
