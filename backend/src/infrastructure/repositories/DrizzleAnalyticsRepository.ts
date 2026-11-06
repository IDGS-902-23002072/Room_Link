import { and, count, eq, gte, lte, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import type {
  AnalyticsTotals,
  IAnalyticsRepository,
  MonthlyMetric,
} from "../../domain/repositories/IAnalyticsRepository.js";
import * as schema from "../../db/schema/index.js";

export class DrizzleAnalyticsRepository implements IAnalyticsRepository {
  constructor(private readonly db: MySql2Database<typeof schema>) {}

  async getTotals(start: Date, end: Date): Promise<AnalyticsTotals> {
    const [users] = await this.db
      .select({ total: count() })
      .from(schema.authUsers)
      .where(
        and(gte(schema.authUsers.createdAt, start), lte(schema.authUsers.createdAt, end)),
      );
    const [rooms] = await this.db
      .select({ total: count() })
      .from(schema.roomListings)
      .where(eq(schema.roomListings.status, "published"));
    const [connections] = await this.db
      .select({
        sent: count(),
        accepted: sql<number>`COALESCE(SUM(CASE WHEN ${schema.connConnections.status} = 'accepted' THEN 1 ELSE 0 END), 0)`,
      })
      .from(schema.connConnections)
      .where(
        and(
          gte(schema.connConnections.createdAt, start),
          lte(schema.connConnections.createdAt, end),
        ),
      );
    const [closures] = await this.db
      .select({
        average: sql<number | null>`AVG(TIMESTAMPDIFF(DAY, ${schema.roomListings.publishedAt}, ${schema.roomListings.closedAt}))`,
      })
      .from(schema.roomListings)
      .where(
        and(
          eq(schema.roomListings.status, "closed"),
          gte(schema.roomListings.closedAt, start),
          lte(schema.roomListings.closedAt, end),
        ),
      );

    return {
      usersRegistered: Number(users?.total ?? 0),
      activeRooms: Number(rooms?.total ?? 0),
      connectionsSent: Number(connections?.sent ?? 0),
      connectionsAccepted: Number(connections?.accepted ?? 0),
      avgDaysToClose:
        closures?.average === null || closures?.average === undefined
          ? null
          : Number(closures.average),
    };
  }

  async getUsersByMonth(start: Date, end: Date): Promise<MonthlyMetric[]> {
    const month = sql<string>`DATE_FORMAT(${schema.authUsers.createdAt}, '%Y-%m')`;
    const rows = await this.db
      .select({ month, total: count() })
      .from(schema.authUsers)
      .where(
        and(gte(schema.authUsers.createdAt, start), lte(schema.authUsers.createdAt, end)),
      )
      .groupBy(month)
      .orderBy(month);
    return rows.map((row) => ({ month: row.month, total: Number(row.total) }));
  }

  async getListingsByMonth(start: Date, end: Date): Promise<MonthlyMetric[]> {
    const month = sql<string>`DATE_FORMAT(${schema.roomListings.publishedAt}, '%Y-%m')`;
    const rows = await this.db
      .select({ month, total: count() })
      .from(schema.roomListings)
      .where(
        and(
          gte(schema.roomListings.publishedAt, start),
          lte(schema.roomListings.publishedAt, end),
        ),
      )
      .groupBy(month)
      .orderBy(month);
    return rows.map((row) => ({ month: row.month, total: Number(row.total) }));
  }
}
