import type { IUserRepository } from "../../domain/repositories/IUserRepository.js";
import type {
  AnalyticsTotals,
  IAnalyticsRepository,
  MonthlyMetric,
} from "../../domain/repositories/IAnalyticsRepository.js";

export class AnalyticsError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 403 | 404,
  ) {
    super(message);
    this.name = "AnalyticsError";
  }
}

export interface AdminDashboard {
  period: { start: string; end: string };
  kpis: AnalyticsTotals & { connectionAcceptanceRate: number | null };
  monthlyUsers: MonthlyMetric[];
  monthlyListings: MonthlyMetric[];
}

function monthsBetween(start: Date, end: Date): string[] {
  const months: string[] = [];
  const current = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
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
    private readonly userRepository: IUserRepository,
    private readonly analyticsRepository: IAnalyticsRepository,
  ) {}

  async getDashboard(
    userId: string,
    start: Date,
    end: Date,
  ): Promise<AdminDashboard> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new AnalyticsError("No se encontró el usuario administrador.", 404);
    }
    if (!user.isActive() || !user.hasRole("admin")) {
      throw new AnalyticsError("Esta sección es solo para administradores.", 403);
    }

    const [totals, monthlyUsers, monthlyListings] = await Promise.all([
      this.analyticsRepository.getTotals(start, end),
      this.analyticsRepository.getUsersByMonth(start, end),
      this.analyticsRepository.getListingsByMonth(start, end),
    ]);
    const months = monthsBetween(start, end);

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
}
