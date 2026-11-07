import type { Sanction } from "../entities/Sanction.js";

export interface ISanctionRepository {
  findById(id: string): Promise<Sanction | null>;
  listForUser(userId: string): Promise<Sanction[]>;
  listActiveForUser(userId: string, at: Date): Promise<Sanction[]>;
  listForListing(listingId: string): Promise<Sanction[]>;
  create(sanction: Sanction): Promise<Sanction>;
  revoke(id: string, at: Date): Promise<void>;
}
