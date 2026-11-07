import type { ActivityLogEntry } from "../entities/ActivityLogEntry.js";

export interface ActivityLogFilter {
  userId?: string;
  action?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

export interface IActivityLogRepository {
  create(entry: ActivityLogEntry): Promise<ActivityLogEntry>;
  list(filter?: ActivityLogFilter): Promise<ActivityLogEntry[]>;
  count(filter?: ActivityLogFilter): Promise<number>;
}
