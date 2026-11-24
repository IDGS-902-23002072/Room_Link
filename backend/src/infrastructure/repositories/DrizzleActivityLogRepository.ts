import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  modActivityLog,
  type ModActivityLogRow,
  type NewModActivityLog,
} from "../../db/schema/governance.js";
import {
  ActivityLogEntry,
  type ActivityLogFilter,
  type IActivityLogRepository,
} from "../../domain/index.js";

export class DrizzleActivityLogRepository implements IActivityLogRepository {
  constructor(private readonly db: MySql2Database<any>) {}

  async create(entry: ActivityLogEntry): Promise<ActivityLogEntry> {
    const record: NewModActivityLog = {
      userId: entry.userId,
      action: entry.action,
      metadata: entry.metadata,
      ipAddress: entry.ipAddress,
      createdAt: entry.createdAt,
    };
    await this.db.insert(modActivityLog).values(record);
    return entry;
  }

  async list(filter: ActivityLogFilter = {}): Promise<ActivityLogEntry[]> {
    const conditions = this.buildConditions(filter);
    const limit = filter.limit ?? 50;
    const offset = filter.offset ?? 0;
    const query = this.db.select().from(modActivityLog);
    const rows: ModActivityLogRow[] = conditions
      ? await query
          .where(conditions)
          .orderBy(desc(modActivityLog.createdAt))
          .limit(limit)
          .offset(offset)
      : await query
          .orderBy(desc(modActivityLog.createdAt))
          .limit(limit)
          .offset(offset);
    return rows.map((row) => this.toDomain(row));
  }

  async count(filter: ActivityLogFilter = {}): Promise<number> {
    const conditions = this.buildConditions(filter);
    const query = this.db
      .select({ value: sql<number>`count(*)` })
      .from(modActivityLog);
    const [row] = conditions ? await query.where(conditions) : await query;
    return Number(row?.value ?? 0);
  }

  private buildConditions(filter: ActivityLogFilter) {
    const parts = [] as any[];
    if (filter.userId) parts.push(eq(modActivityLog.userId, filter.userId));
    if (filter.action) parts.push(eq(modActivityLog.action, filter.action));
    if (filter.from) parts.push(gte(modActivityLog.createdAt, filter.from));
    if (filter.to) parts.push(lte(modActivityLog.createdAt, filter.to));
    if (!parts.length) return undefined;
    return parts.length === 1 ? parts[0] : and(...parts);
  }

  private toDomain(row: ModActivityLogRow): ActivityLogEntry {
    return new ActivityLogEntry({
      id: row.id,
      userId: row.userId ?? null,
      action: row.action,
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
      ipAddress: row.ipAddress ?? null,
      createdAt: new Date(row.createdAt),
    });
  }
}
