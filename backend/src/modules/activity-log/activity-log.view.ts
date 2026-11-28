import type { ActivityLogEntry } from "../../domain/index.js";
import { describeEvent } from "./activity-log.describe.js";

export interface ActivityLogDTO {
  id: number | null;
  userId: string | null;
  action: string;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: string;
  module: string;
  outcome: string;
  description: string;
}

export class ActivityLogView {
  static toDTO(entry: ActivityLogEntry): ActivityLogDTO {
    // Registros anteriores a la migración no traen descripción: se redacta al leerlos.
    const fallback = describeEvent(entry.action, entry.metadata);
    return {
      id: entry.id,
      userId: entry.userId,
      action: entry.action,
      metadata: entry.metadata,
      ipAddress: entry.ipAddress,
      createdAt: entry.createdAt.toISOString(),
      module: entry.module ?? fallback.module,
      outcome: entry.outcome ?? fallback.outcome,
      description: entry.description ?? fallback.message,
    };
  }

  static toList(items: ActivityLogEntry[]): ActivityLogDTO[] {
    return items.map((e) => ActivityLogView.toDTO(e));
  }
}
