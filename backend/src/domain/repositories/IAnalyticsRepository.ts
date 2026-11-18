import type { DailyMetrics } from "../entities/DailyMetrics.js";

export interface AnalyticsTotals {
  usersRegistered: number;
  activeRooms: number;
  connectionsSent: number;
  connectionsAccepted: number;
  avgDaysToClose: number | null;
}

export interface MonthlyMetric {
  month: string;
  total: number;
}

export interface IAnalyticsRepository {
  upsertDaily(metrics: DailyMetrics): Promise<DailyMetrics>;
  findByDate(metricDate: Date): Promise<DailyMetrics | null>;
  listRange(from: Date, to: Date): Promise<DailyMetrics[]>;
  getTotals?(start: Date, end: Date): Promise<AnalyticsTotals>;
  getUsersByMonth?(start: Date, end: Date): Promise<MonthlyMetric[]>;
  getListingsByMonth?(start: Date, end: Date): Promise<MonthlyMetric[]>;
}

/**
 * Puerto que las métricas consultan para construir cada registro diario.
 * Se mantiene desacoplado del Drizzle y los schemas por módulo para que el
 * servicio pueda probarse con un stub determinista.
 */
export interface IAnalyticsSource {
  countUsersRegisteredOn(day: Date): Promise<number>;
  countActiveListingsAt(day: Date): Promise<number>;
  countConnectionsSentOn(day: Date): Promise<number>;
  countConnectionsAcceptedOn(day: Date): Promise<number>;
  countListingsClosedOn(day: Date): Promise<number>;
  avgDaysToCloseOn(day: Date): Promise<number | null>;
  avgAffinityScoreOn(day: Date): Promise<number | null>;
}
