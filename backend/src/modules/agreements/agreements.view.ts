import type { Agreement, AgreementAcceptance } from "../../domain/index.js";

export interface AgreementDTO {
  id: string;
  listingId: string;
  rulesSnapshot: Record<string, unknown>;
  createdAt: string;
}

export interface AcceptanceDTO {
  agreementId: string;
  userId: string;
  acceptedAt: string | null;
}

export class AgreementView {
  static toDTO(a: Agreement): AgreementDTO {
    return {
      id: a.id,
      listingId: a.listingId,
      rulesSnapshot: a.rulesSnapshot,
      createdAt: a.createdAt.toISOString(),
    };
  }

  static toAcceptance(a: AgreementAcceptance): AcceptanceDTO {
    return {
      agreementId: a.agreementId,
      userId: a.userId,
      acceptedAt: a.acceptedAt ? a.acceptedAt.toISOString() : null,
    };
  }

  static toAcceptanceList(items: AgreementAcceptance[]): AcceptanceDTO[] {
    return items.map((a) => AgreementView.toAcceptance(a));
  }
}
