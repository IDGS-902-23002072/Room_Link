const OFFSET_MS = 6 * 60 * 60 * 1000; // León, Guanajuato: UTC-6.

/** Ventana [inicio, fin) de uno o varios meses, en instantes UTC. */
export function monthWindow(period: string, months = 1): { start: Date; end: Date } {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) throw new Error(`Periodo inválido: ${period}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new Error(`Periodo inválido: ${period}`);
  return {
    start: new Date(Date.UTC(year, month - 1 - (months - 1), 1, 6, 0, 0, 0)),
    end: new Date(Date.UTC(year, month, 1, 6, 0, 0, 0)),
  };
}

const localMidnightNextDay = (local: Date): Date =>
  new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1, 0, 0, 0, 0));

/** Suma horas hábiles (lunes a viernes, 9:00 a 18:00 UTC-6). */
export function addBusinessHours(openedAt: Date, hours: number): Date {
  let cursor = new Date(openedAt.getTime() - OFFSET_MS);
  let remaining = hours;

  while (remaining > 0) {
    const weekday = cursor.getUTCDay();
    if (weekday === 0 || weekday === 6) {
      cursor = localMidnightNextDay(cursor);
      continue;
    }
    const dayStart = Date.UTC(
      cursor.getUTCFullYear(),
      cursor.getUTCMonth(),
      cursor.getUTCDate(),
      9,
      0,
      0,
      0,
    );
    const dayEnd = Date.UTC(
      cursor.getUTCFullYear(),
      cursor.getUTCMonth(),
      cursor.getUTCDate(),
      18,
      0,
      0,
      0,
    );
    if (cursor.getTime() < dayStart) cursor = new Date(dayStart);
    if (cursor.getTime() >= dayEnd) {
      cursor = localMidnightNextDay(cursor);
      continue;
    }
    const availableHours = (dayEnd - cursor.getTime()) / 3_600_000;
    if (remaining <= availableHours) {
      cursor = new Date(cursor.getTime() + remaining * 3_600_000);
      remaining = 0;
    } else {
      remaining -= availableHours;
      cursor = localMidnightNextDay(cursor);
    }
  }

  return new Date(cursor.getTime() + OFFSET_MS);
}
