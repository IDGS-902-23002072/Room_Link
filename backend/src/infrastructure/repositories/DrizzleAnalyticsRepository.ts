import { and, eq, gte, lte, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { authUsers } from "../../db/schema/auth.js";
import { analyticsDailyMetrics } from "../../db/schema/governance.js";
import { roomListings } from "../../db/schema/rooms.js";
import { appApplications, connConnections } from "../../db/schema/social.js";
import {
  DailyMetrics,
  toUtcMidnight,
  type IAnalyticsRepository,
  type IAnalyticsSource,
} from "../../domain/index.js";

function dayRange(day: Date): { start: Date; end: Date; isoDate: string } {
  const start = toUtcMidnight(day);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end, isoDate: start.toISOString().slice(0, 10) };
}

export class DrizzleAnalyticsRepository implements IAnalyticsRepository {
  constructor(private readonly db: MySql2Database<any>) {}

  async upsertDaily(metrics: DailyMetrics): Promise<DailyMetrics> {
    const metricDate = toUtcMidnight(metrics.metricDate);
    const values = {
      metricDate,
      usersRegistered: metrics.usersRegistered,
      activeListings: metrics.activeListings,
      connectionsSent: metrics.connectionsSent,
      connectionsAccepted: metrics.connectionsAccepted,
      listingsClosed: metrics.listingsClosed,
      avgDaysToClose:
        metrics.avgDaysToClose !== null ? metrics.avgDaysToClose.toFixed(2) : null,
      avgAffinityScore:
        metrics.avgAffinityScore !== null ? metrics.avgAffinityScore.toFixed(2) : null,
      createdAt: metrics.createdAt,
    };
    // MySQL upsert por PK (`metric_date`)
    await this.db
      .insert(analyticsDailyMetrics)
      .values(values as any)
      .onDuplicateKeyUpdate({
        set: {
          usersRegistered: values.usersRegistered,
          activeListings: values.activeListings,
          connectionsSent: values.connectionsSent,
          connectionsAccepted: values.connectionsAccepted,
          listingsClosed: values.listingsClosed,
          avgDaysToClose: values.avgDaysToClose,
          avgAffinityScore: values.avgAffinityScore,
        },
      });
    return metrics;
  }

  async findByDate(metricDate: Date): Promise<DailyMetrics | null> {
    const day = toUtcMidnight(metricDate);
    const rows = await this.db
      .select()
      .from(analyticsDailyMetrics)
      .where(eq(analyticsDailyMetrics.metricDate, day))
      .limit(1);
    const row = rows[0];
    return row ? this.toDomain(row) : null;
  }

  async listRange(from: Date, to: Date): Promise<DailyMetrics[]> {
    const fromD = toUtcMidnight(from);
    const toD = toUtcMidnight(to);
    const rows = await this.db
      .select()
      .from(analyticsDailyMetrics)
      .where(
        and(
          gte(analyticsDailyMetrics.metricDate, fromD),
          lte(analyticsDailyMetrics.metricDate, toD),
        ),
      );
    return rows.map((row) => this.toDomain(row));
  }

  private toDomain(row: typeof analyticsDailyMetrics.$inferSelect): DailyMetrics {
    const parseNumeric = (value: string | null): number | null =>
      value === null ? null : Number(value);
    return new DailyMetrics({
      metricDate: toUtcMidnight(new Date(row.metricDate)),
      usersRegistered: row.usersRegistered,
      activeListings: row.activeListings,
      connectionsSent: row.connectionsSent,
      connectionsAccepted: row.connectionsAccepted,
      listingsClosed: row.listingsClosed,
      avgDaysToClose: parseNumeric(row.avgDaysToClose),
      avgAffinityScore: parseNumeric(row.avgAffinityScore),
      createdAt: new Date(row.createdAt),
    });
  }
}

export class DrizzleAnalyticsSource implements IAnalyticsSource {
  constructor(private readonly db: MySql2Database<any>) {}

  async countUsersRegisteredOn(day: Date): Promise<number> {
    const { start, end } = dayRange(day);
    const [row] = await this.db
      .select({ value: sql<number>`count(*)` })
      .from(authUsers)
      .where(and(gte(authUsers.createdAt, start), lte(authUsers.createdAt, end)));
    return Number(row?.value ?? 0);
  }

  async countActiveListingsAt(_day: Date): Promise<number> {
    // Snapshot "a hoy": listings con status published. Para precisión histórica
    // habría que unir con una tabla de eventos de publicación; se deja como mejora.
    const [row] = await this.db
      .select({ value: sql<number>`count(*)` })
      .from(roomListings)
      .where(eq(roomListings.status, "published"));
    return Number(row?.value ?? 0);
  }

  async countConnectionsSentOn(day: Date): Promise<number> {
    const { start, end } = dayRange(day);
    const [row] = await this.db
      .select({ value: sql<number>`count(*)` })
      .from(connConnections)
      .where(
        and(
          gte(connConnections.createdAt, start),
          lte(connConnections.createdAt, end),
        ),
      );
    return Number(row?.value ?? 0);
  }

  async countConnectionsAcceptedOn(day: Date): Promise<number> {
    const { start, end } = dayRange(day);
    const [row] = await this.db
      .select({ value: sql<number>`count(*)` })
      .from(connConnections)
      .where(
        and(
          eq(connConnections.status, "accepted"),
          gte(connConnections.respondedAt, start),
          lte(connConnections.respondedAt, end),
        ),
      );
    return Number(row?.value ?? 0);
  }

  async countListingsClosedOn(day: Date): Promise<number> {
    const { start, end } = dayRange(day);
    const [row] = await this.db
      .select({ value: sql<number>`count(*)` })
      .from(roomListings)
      .where(
        and(
          eq(roomListings.status, "closed"),
          gte(roomListings.closedAt, start),
          lte(roomListings.closedAt, end),
        ),
      );
    return Number(row?.value ?? 0);
  }

  async avgDaysToCloseOn(day: Date): Promise<number | null> {
    const { start, end } = dayRange(day);
    const [row] = await this.db
      .select({
        value: sql<string | null>`AVG(TIMESTAMPDIFF(SECOND, ${roomListings.createdAt}, ${roomListings.closedAt})) / 86400.0`,
      })
      .from(roomListings)
      .where(
        and(
          eq(roomListings.status, "closed"),
          gte(roomListings.closedAt, start),
          lte(roomListings.closedAt, end),
        ),
      );
    return row?.value === null || row?.value === undefined ? null : Number(row.value);
  }

  async avgAffinityScoreOn(day: Date): Promise<number | null> {
    const { start, end } = dayRange(day);
    const [row] = await this.db
      .select({
        value: sql<string | null>`AVG(${appApplications.compatibilityScore})`,
      })
      .from(appApplications)
      .where(
        and(
          gte(appApplications.createdAt, start),
          lte(appApplications.createdAt, end),
        ),
      );
    return row?.value === null || row?.value === undefined ? null : Number(row.value);
  }
}
