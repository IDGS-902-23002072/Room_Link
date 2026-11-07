import type { Agreement, AgreementAcceptance } from "../entities/Agreement.js";

export interface IAgreementRepository {
  findById(id: string): Promise<Agreement | null>;
  listByListingId(listingId: string): Promise<Agreement[]>;
  create(agreement: Agreement): Promise<Agreement>;
  findAcceptance(agreementId: string, userId: string): Promise<AgreementAcceptance | null>;
  listAcceptances(agreementId: string): Promise<AgreementAcceptance[]>;
  upsertAcceptance(acceptance: AgreementAcceptance): Promise<AgreementAcceptance>;
}
