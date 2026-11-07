import type { DailyMetrics } from "../../domain/index.js";

export interface DailyMetricsDTO {
  metricDate: string;
  usersRegistered: number;
  activeListings: number;
  connectionsSent: number;
  connectionsAccepted: number;
  listingsClosed: number;
  avgDaysToClose: number | null;
  avgAffinityScore: number | null;
}

export class AnalyticsView {
  static toDTO(metrics: DailyMetrics): DailyMetricsDTO {
    return {
      metricDate: metrics.metricDate.toISOString().slice(0, 10),
      usersRegistered: metrics.usersRegistered,
      activeListings: metrics.activeListings,
      connectionsSent: metrics.connectionsSent,
      connectionsAccepted: metrics.connectionsAccepted,
      listingsClosed: metrics.listingsClosed,
      avgDaysToClose: metrics.avgDaysToClose,
      avgAffinityScore: metrics.avgAffinityScore,
    };
  }

  static toList(items: DailyMetrics[]): DailyMetricsDTO[] {
    return items.map((m) => AnalyticsView.toDTO(m));
  }
}
