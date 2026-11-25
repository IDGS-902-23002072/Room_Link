import { and, count, eq, gte, lte, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { authUsers } from "../../db/schema/auth.js";
import { analyticsDailyMetrics } from "../../db/schema/governance.js";
import { roomListings } from "../../db/schema/rooms.js";
import { appApplications, connConnections } from "../../db/schema/social.js";
import {
  DailyMetrics,
  toUtcMidnight,
  type AnalyticsTotals,
  type IAnalyticsRepository,
  type IAnalyticsSource,
  type MonthlyMetric,
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

  async getTotals(start: Date, end: Date): Promise<AnalyticsTotals> {
    const [users] = await this.db
      .select({ total: count() })
      .from(authUsers)
      .where(and(gte(authUsers.createdAt, start), lte(authUsers.createdAt, end)));
    const [rooms] = await this.db
      .select({ total: count() })
      .from(roomListings)
      .where(eq(roomListings.status, "published"));
    const [connections] = await this.db
      .select({
        sent: count(),
        accepted: sql<number>`COALESCE(SUM(CASE WHEN ${connConnections.status} = 'accepted' THEN 1 ELSE 0 END), 0)`,
      })
      .from(connConnections)
      .where(
        and(
          gte(connConnections.createdAt, start),
          lte(connConnections.createdAt, end),
        ),
      );
    const [closures] = await this.db
      .select({
        average: sql<number | null>`AVG(TIMESTAMPDIFF(DAY, ${roomListings.publishedAt}, ${roomListings.closedAt}))`,
      })
      .from(roomListings)
      .where(
        and(
          eq(roomListings.status, "closed"),
          gte(roomListings.closedAt, start),
          lte(roomListings.closedAt, end),
        ),
      );

    const [[listingCohort], [affinity]] = await Promise.all([
      this.db.select({
        published: count(),
        occupied: sql<number>`COALESCE(SUM(EXISTS (
          SELECT 1 FROM ${appApplications}
          WHERE ${appApplications.listingId} = ${roomListings.id}
            AND ${appApplications.status} = 'accepted'
            AND ${appApplications.decidedAt} <= ${end}
        )), 0)`,
      }).from(roomListings).where(and(gte(roomListings.publishedAt, start), lte(roomListings.publishedAt, end))),
      this.db.select({
        count: sql<number>`COUNT(${appApplications.compatibilityScore})`,
        average: sql<number | null>`AVG(${appApplications.compatibilityScore})`,
      }).from(appApplications).where(and(gte(appApplications.createdAt, start), lte(appApplications.createdAt, end))),
    ]);

    return {
      usersRegistered: Number(users?.total ?? 0),
      activeRooms: Number(rooms?.total ?? 0),
      publishedListings: Number(listingCohort?.published ?? 0),
      listingsWithAcceptedApplication: Number(listingCohort?.occupied ?? 0),
      scoredApplications: Number(affinity?.count ?? 0),
      avgApplicationAffinity: affinity?.average == null ? null : Number(affinity.average),
      connectionsSent: Number(connections?.sent ?? 0),
      connectionsAccepted: Number(connections?.accepted ?? 0),
      avgDaysToClose:
        closures?.average === null || closures?.average === undefined
          ? null
          : Number(closures.average),
    };
  }

  async getUsersByMonth(start: Date, end: Date): Promise<MonthlyMetric[]> {
    const month = sql<string>`DATE_FORMAT(${authUsers.createdAt}, '%Y-%m')`;
    const rows = await this.db
      .select({ month, total: count() })
      .from(authUsers)
      .where(and(gte(authUsers.createdAt, start), lte(authUsers.createdAt, end)))
      .groupBy(month)
      .orderBy(month);
    return rows.map((row: { month: string; total: number }) => ({
      month: row.month,
      total: Number(row.total),
    }));
  }

  async getListingsByMonth(start: Date, end: Date): Promise<MonthlyMetric[]> {
    const month = sql<string>`DATE_FORMAT(${roomListings.publishedAt}, '%Y-%m')`;
    const rows = await this.db
      .select({ month, total: count() })
      .from(roomListings)
      .where(
        and(
          gte(roomListings.publishedAt, start),
          lte(roomListings.publishedAt, end),
        ),
      )
      .groupBy(month)
      .orderBy(month);
    return rows.map((row: { month: string; total: number }) => ({
      month: row.month,
      total: Number(row.total),
    }));
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
