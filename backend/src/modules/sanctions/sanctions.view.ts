import type { Sanction } from "../../domain/index.js";

export interface SanctionDTO {
  id: string;
  reportId: string | null;
  adminId: string;
  userId: string | null;
  listingId: string | null;
  type: Sanction["type"];
  reason: string;
  expiresAt: string | null;
  createdAt: string;
}

export class SanctionView {
  static toDTO(s: Sanction): SanctionDTO {
    return {
      id: s.id,
      reportId: s.reportId,
      adminId: s.adminId,
      userId: s.userId,
      listingId: s.listingId,
      type: s.type,
      reason: s.reason,
      expiresAt: s.expiresAt ? s.expiresAt.toISOString() : null,
      createdAt: s.createdAt.toISOString(),
    };
  }

  static toList(items: Sanction[]): SanctionDTO[] {
    return items.map((s) => SanctionView.toDTO(s));
  }
}
