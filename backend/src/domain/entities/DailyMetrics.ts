export interface DailyMetricsProps {
  metricDate: Date;
  usersRegistered: number;
  activeListings: number;
  connectionsSent: number;
  connectionsAccepted: number;
  listingsClosed: number;
  avgDaysToClose: number | null;
  avgAffinityScore: number | null;
  createdAt: Date;
}

/**
 * Métricas agregadas por día. La clave de agregación es `metricDate` truncada
 * a día (00:00:00 UTC). Un recompute debe ser idempotente por esa clave.
 */
export class DailyMetrics {
  metricDate: Date;
  usersRegistered: number;
  activeListings: number;
  connectionsSent: number;
  connectionsAccepted: number;
  listingsClosed: number;
  avgDaysToClose: number | null;
  avgAffinityScore: number | null;
  createdAt: Date;

  constructor(props: DailyMetricsProps) {
    for (const key of [
      "usersRegistered",
      "activeListings",
      "connectionsSent",
      "connectionsAccepted",
      "listingsClosed",
    ] as const) {
      const value = props[key];
      if (!Number.isInteger(value) || value < 0) {
        throw new Error(`${key} debe ser un entero >= 0.`);
      }
    }
    this.metricDate = props.metricDate;
    this.usersRegistered = props.usersRegistered;
    this.activeListings = props.activeListings;
    this.connectionsSent = props.connectionsSent;
    this.connectionsAccepted = props.connectionsAccepted;
    this.listingsClosed = props.listingsClosed;
    this.avgDaysToClose = props.avgDaysToClose;
    this.avgAffinityScore = props.avgAffinityScore;
    this.createdAt = props.createdAt;
  }
}

/** Normaliza una fecha al inicio del día UTC (00:00:00.000). */
export function toUtcMidnight(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
