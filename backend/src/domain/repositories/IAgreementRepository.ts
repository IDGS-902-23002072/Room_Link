import type { Agreement } from "../entities/Agreement.js";

export interface ListingSnapshotInput {
  listingId: string;
}

export interface ListingRulesAndCosts {
  listingTitle: string;
  hostId: string;
  visitsPolicy: string | null;
  partiesAllowed: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  petsAllowed: boolean;
  smokingAllowed: boolean;
  commonAreasNotes: string | null;
  extraRules: string | null;
  costs: Array<{
    kind: string;
    concept: string;
    amount: number;
    isIncluded: boolean;
    isProrated: boolean;
  }>;
}

export interface IAgreementRepository {
  /** Lee reglas, costos y anfitrión del listing para construir el snapshot. */
  getListingSnapshot(listingId: string): Promise<ListingRulesAndCosts | null>;

  findById(agreementId: string): Promise<Agreement | null>;
  findByListing(listingId: string): Promise<Agreement[]>;
  findByUser(userId: string): Promise<Agreement[]>;

  create(agreement: Agreement): Promise<Agreement>;
  recordAcceptance(
    agreementId: string,
    userId: string,
    acceptedAt: Date,
  ): Promise<void>;
}
