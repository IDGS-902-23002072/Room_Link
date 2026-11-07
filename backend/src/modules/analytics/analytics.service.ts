import {
  DailyMetrics,
  toUtcMidnight,
  type IAnalyticsRepository,
  type IAnalyticsSource,
} from "../../domain/index.js";
import { AppError } from "../../shared/AppError.js";

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
}
