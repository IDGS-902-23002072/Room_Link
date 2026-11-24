import {
  DailyMetrics,
  toUtcMidnight,
  type AnalyticsTotals,
  type IAnalyticsRepository,
  type IAnalyticsSource,
  type MonthlyMetric,
} from "../../domain/index.js";
import { AppError } from "../../shared/AppError.js";

export interface AdminDashboard {
  period: { start: string; end: string };
  kpis: AnalyticsTotals & { connectionAcceptanceRate: number | null };
  monthlyUsers: MonthlyMetric[];
  monthlyListings: MonthlyMetric[];
}

function monthsBetween(start: Date, end: Date): string[] {
  const months: string[] = [];
  const current = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1),
  );
  const last = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1);
  while (current.getTime() <= last) {
    months.push(
      `${current.getUTCFullYear()}-${String(current.getUTCMonth() + 1).padStart(2, "0")}`,
    );
    current.setUTCMonth(current.getUTCMonth() + 1);
  }
  return months;
}

function fillMonths(months: string[], rows: MonthlyMetric[]): MonthlyMetric[] {
  const totals = new Map(rows.map(({ month, total }) => [month, total]));
  return months.map((month) => ({ month, total: totals.get(month) ?? 0 }));
}

export class AnalyticsService {
  constructor(
    private readonly repo: IAnalyticsRepository,
    private readonly source: IAnalyticsSource,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /**
   * Recalcula las métricas del día indicado y hace UPSERT por `metricDate`.
   * La operación es idempotente: dos llamadas con la misma fecha producen el
   * mismo registro final.
   */
  async recomputeDaily(day: Date): Promise<DailyMetrics> {
    if (Number.isNaN(day.getTime())) {
      throw new AppError("Fecha inválida.", 400, "INVALID_METRIC_DATE");
    }
    const metricDate = toUtcMidnight(day);
    if (metricDate.getTime() > toUtcMidnight(this.now()).getTime()) {
      throw new AppError(
        "No se pueden computar métricas de fechas futuras.",
        400,
        "METRIC_DATE_IN_FUTURE",
      );
    }
    const [
      usersRegistered,
      activeListings,
      connectionsSent,
      connectionsAccepted,
      listingsClosed,
      avgDaysToClose,
      avgAffinityScore,
    ] = await Promise.all([
      this.source.countUsersRegisteredOn(metricDate),
      this.source.countActiveListingsAt(metricDate),
      this.source.countConnectionsSentOn(metricDate),
      this.source.countConnectionsAcceptedOn(metricDate),
      this.source.countListingsClosedOn(metricDate),
      this.source.avgDaysToCloseOn(metricDate),
      this.source.avgAffinityScoreOn(metricDate),
    ]);

    const metrics = new DailyMetrics({
      metricDate,
      usersRegistered,
      activeListings,
      connectionsSent,
      connectionsAccepted,
      listingsClosed,
      avgDaysToClose,
      avgAffinityScore,
      createdAt: this.now(),
    });
    return this.repo.upsertDaily(metrics);
  }

  async getRange(from: Date, to: Date): Promise<DailyMetrics[]> {
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new AppError("Rango inválido.", 400, "INVALID_RANGE");
    }
    const fromD = toUtcMidnight(from);
    const toD = toUtcMidnight(to);
    if (fromD.getTime() > toD.getTime()) {
      throw new AppError(
        "`from` no puede ser mayor que `to`.",
        400,
        "INVALID_RANGE_ORDER",
      );
    }
    return this.repo.listRange(fromD, toD);
  }

  async getDashboard(start: Date, end: Date): Promise<AdminDashboard> {
    const months = monthsBetween(start, end);
    if (
      typeof this.repo.getTotals === "function" &&
      typeof this.repo.getUsersByMonth === "function" &&
      typeof this.repo.getListingsByMonth === "function"
    ) {
      const [totals, monthlyUsers, monthlyListings] = await Promise.all([
        this.repo.getTotals(start, end),
        this.repo.getUsersByMonth(start, end),
        this.repo.getListingsByMonth(start, end),
      ]);
      return {
        period: {
          start: start.toISOString().slice(0, 10),
          end: end.toISOString().slice(0, 10),
        },
        kpis: {
          ...totals,
          connectionAcceptanceRate:
            totals.connectionsSent === 0
              ? null
              : Math.round(
                  (totals.connectionsAccepted / totals.connectionsSent) * 10_000,
                ) / 100,
        },
        monthlyUsers: fillMonths(months, monthlyUsers),
        monthlyListings: fillMonths(months, monthlyListings),
      };
    }

    // Fallback a partir de DailyMetrics (para fakes de tests in-memory)
    const items = await this.getRange(start, end);
    const usersRegistered = items.reduce((s, m) => s + m.usersRegistered, 0);
    const activeRooms =
      items.length > 0 ? items[items.length - 1]!.activeListings : 0;
    const connectionsSent = items.reduce((s, m) => s + m.connectionsSent, 0);
    const connectionsAccepted = items.reduce(
      (s, m) => s + m.connectionsAccepted,
      0,
    );
    const closeValues = items
      .map((m) => m.avgDaysToClose)
      .filter((v): v is number => v !== null);
    const avgDaysToClose =
      closeValues.length > 0
        ? closeValues.reduce((s, v) => s + v, 0) / closeValues.length
        : null;

    const usersByMonth = new Map<string, number>();
    const listingsByMonth = new Map<string, number>();
    for (const m of items) {
      const month = m.metricDate.toISOString().slice(0, 7);
      usersByMonth.set(month, (usersByMonth.get(month) ?? 0) + m.usersRegistered);
      listingsByMonth.set(
        month,
        (listingsByMonth.get(month) ?? 0) + m.activeListings,
      );
    }

    return {
      period: {
        start: start.toISOString().slice(0, 10),
        end: end.toISOString().slice(0, 10),
      },
      kpis: {
        usersRegistered,
        activeRooms,
        connectionsSent,
        connectionsAccepted,
        avgDaysToClose,
        connectionAcceptanceRate:
          connectionsSent === 0
            ? null
            : Math.round((connectionsAccepted / connectionsSent) * 10_000) /
              100,
      },
      monthlyUsers: fillMonths(
        months,
        Array.from(usersByMonth, ([month, total]) => ({ month, total })),
      ),
      monthlyListings: fillMonths(
        months,
        Array.from(listingsByMonth, ([month, total]) => ({ month, total })),
      ),
    };
  }
}
