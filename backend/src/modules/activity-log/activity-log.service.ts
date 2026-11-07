import {
  ActivityLogEntry,
  type ActivityLogFilter,
  type IActivityLogRepository,
} from "../../domain/index.js";

export interface LogInput {
  userId?: string | null;
  action: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}

export class ActivityLogService {
  constructor(
    private readonly repo: IActivityLogRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  log(input: LogInput): Promise<ActivityLogEntry> {
    return this.repo.create(
      new ActivityLogEntry({
        userId: input.userId ?? null,
        action: input.action,
        metadata: input.metadata ?? {},
        ipAddress: input.ipAddress ?? null,
        createdAt: this.now(),
      }),
    );
  }

  list(filter: ActivityLogFilter = {}) {
    return this.repo.list(filter);
  }

  count(filter: ActivityLogFilter = {}) {
    return this.repo.count(filter);
  }
}
