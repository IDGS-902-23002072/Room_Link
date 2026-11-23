import type { Agreement } from "../../domain/index.js";

export interface AgreementDto {
  id: string;
  listingId: string;
  version: number;
  supersedesAgreementId: string | null;
  hostId: string;
  roomieIds: string[];
  rulesSnapshot: Record<string, unknown>;
  acceptances: Array<{ userId: string; acceptedAt: string | null }>;
  fullyAccepted: boolean;
  createdAt: string;
}

export class AgreementsView {
  public static toDto(agreement: Agreement): AgreementDto {
    return {
      id: agreement.id,
      listingId: agreement.listingId,
      version: agreement.version,
      supersedesAgreementId: agreement.supersedesAgreementId,
      hostId: agreement.hostId,
      roomieIds: agreement.roomieIds,
      rulesSnapshot: agreement.rulesSnapshot as unknown as Record<
        string,
        unknown
      >,
      acceptances: agreement.acceptances.map((a) => ({
        userId: a.userId,
        acceptedAt: a.acceptedAt ? a.acceptedAt.toISOString() : null,
      })),
      fullyAccepted: agreement.isFullyAccepted(),
      createdAt: agreement.createdAt.toISOString(),
    };
  }
}
