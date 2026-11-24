import type { ActivityLogEntry } from "../../domain/index.js";

export interface ActivityLogDTO {
  id: number | null;
  userId: string | null;
  action: string;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: string;
}

export class ActivityLogView {
  static toDTO(entry: ActivityLogEntry): ActivityLogDTO {
    return {
      id: entry.id,
      userId: entry.userId,
      action: entry.action,
      metadata: entry.metadata,
      ipAddress: entry.ipAddress,
      createdAt: entry.createdAt.toISOString(),
    };
  }

  static toList(items: ActivityLogEntry[]): ActivityLogDTO[] {
    return items.map((e) => ActivityLogView.toDTO(e));
  }
}
