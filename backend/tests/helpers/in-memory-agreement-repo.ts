import {
  Agreement,
  type IAgreementRepository,
  type ListingRulesAndCosts,
} from "../../src/domain/index.js";

/**
 * Repositorio de acuerdos en memoria para pruebas (HU-12, módulo de Roberto).
 * Implementa la interfaz extendida IAgreementRepository.
 */
export class InMemoryAgreementRepository implements IAgreementRepository {
  public agreements: Map<string, Agreement> = new Map();
  public acceptances: Array<{ id: string; userId: string; at: Date }> = [];
  public snapshots: Map<string, ListingRulesAndCosts> = new Map();

  async getListingSnapshot(
    listingId: string,
  ): Promise<ListingRulesAndCosts | null> {
    return this.snapshots.get(listingId) ?? null;
  }

  async findById(agreementId: string): Promise<Agreement | null> {
    return this.agreements.get(agreementId) ?? null;
  }

  async findByListing(listingId: string): Promise<Agreement[]> {
    return Array.from(this.agreements.values()).filter(
      (a) => a.listingId === listingId,
    );
  }

  async findByUser(userId: string): Promise<Agreement[]> {
    return Array.from(this.agreements.values()).filter((a) =>
      a.isParticipant(userId),
    );
  }

  async create(agreement: Agreement): Promise<Agreement> {
    this.agreements.set(agreement.id, agreement);
    return agreement;
  }

  async recordAcceptance(
    agreementId: string,
    userId: string,
    acceptedAt: Date,
  ): Promise<void> {
    this.acceptances.push({ id: agreementId, userId, at: acceptedAt });
  }
}
