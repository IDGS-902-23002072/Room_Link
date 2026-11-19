import { and, eq, inArray, or } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  Agreement,
  type AgreementAcceptanceProps,
  type AgreementRuleSet,
  type IAgreementRepository,
  type ListingRulesAndCosts,
} from "../../domain/index.js";
import {
  agreementAgreements,
  agreementAcceptances,
} from "../../db/schema/governance.js";
import {
  roomListings,
  roomRules,
  roomCostItems,
} from "../../db/schema/rooms.js";

interface AgreementRow {
  id: string;
  listingId: string;
  rulesSnapshot: unknown;
  createdAt: Date;
}

export class DrizzleAgreementRepository implements IAgreementRepository {
  constructor(private db: MySql2Database<any>) {}

  async getListingSnapshot(
    listingId: string,
  ): Promise<ListingRulesAndCosts | null> {
    const listingRows = await this.db
      .select({
        id: roomListings.id,
        title: roomListings.title,
        hostId: roomListings.hostId,
      })
      .from(roomListings)
      .where(eq(roomListings.id, listingId))
      .limit(1);

    const listing = listingRows[0];
    if (!listing) return null;

    const ruleRows = await this.db
      .select()
      .from(roomRules)
      .where(eq(roomRules.listingId, listingId))
      .limit(1);

    const costRows = await this.db
      .select()
      .from(roomCostItems)
      .where(eq(roomCostItems.listingId, listingId));

    const rule = ruleRows[0];

    return {
      listingTitle: listing.title,
      hostId: listing.hostId,
      visitsPolicy: rule?.visitsPolicy ?? null,
      partiesAllowed: Boolean(rule?.partiesAllowed ?? false),
      quietHoursStart: rule?.quietHoursStart ?? null,
      quietHoursEnd: rule?.quietHoursEnd ?? null,
      petsAllowed: Boolean(rule?.petsAllowed ?? false),
      smokingAllowed: Boolean(rule?.smokingAllowed ?? false),
      commonAreasNotes: rule?.commonAreasNotes ?? null,
      extraRules: rule?.extraRules ?? null,
      costs: costRows.map((c) => ({
        kind: c.kind,
        concept: c.concept,
        amount: Number(c.amount),
        isIncluded: Boolean(c.isIncluded),
        isProrated: Boolean(c.isProrated),
      })),
    };
  }

  async findById(agreementId: string): Promise<Agreement | null> {
    const rows = (await this.db
      .select()
      .from(agreementAgreements)
      .where(eq(agreementAgreements.id, agreementId))
      .limit(1)) as AgreementRow[];
    const row = rows[0];
    if (!row) return null;
    return this.hydrate(row);
  }

  async findByListing(listingId: string): Promise<Agreement[]> {
    const rows = (await this.db
      .select()
      .from(agreementAgreements)
      .where(eq(agreementAgreements.listingId, listingId))) as AgreementRow[];
    const results: Agreement[] = [];
    for (const row of rows) {
      results.push(await this.hydrate(row));
    }
    return results;
  }

  async findByUser(userId: string): Promise<Agreement[]> {
    const acceptanceRows = await this.db
      .select({ agreementId: agreementAcceptances.agreementId })
      .from(agreementAcceptances)
      .where(eq(agreementAcceptances.userId, userId));
    const ids = acceptanceRows.map((r) => r.agreementId);
    if (ids.length === 0) return [];
    const rows = (await this.db
      .select()
      .from(agreementAgreements)
      .where(inArray(agreementAgreements.id, ids))) as AgreementRow[];
    const results: Agreement[] = [];
    for (const row of rows) {
      results.push(await this.hydrate(row));
    }
    return results;
  }

  async create(agreement: Agreement): Promise<Agreement> {
    await this.db.insert(agreementAgreements).values({
      id: agreement.id,
      listingId: agreement.listingId,
      rulesSnapshot: agreement.rulesSnapshot as unknown as Record<string, unknown>,
    });

    for (const acceptance of agreement.acceptances) {
      await this.db.insert(agreementAcceptances).values({
        agreementId: agreement.id,
        userId: acceptance.userId,
        acceptedAt: acceptance.acceptedAt ?? null,
      });
    }
    return agreement;
  }

  async recordAcceptance(
    agreementId: string,
    userId: string,
    acceptedAt: Date,
  ): Promise<void> {
    await this.db
      .insert(agreementAcceptances)
      .values({ agreementId, userId, acceptedAt })
      .onDuplicateKeyUpdate({ set: { acceptedAt } });
  }

  private async hydrate(row: AgreementRow): Promise<Agreement> {
    const acceptanceRows = await this.db
      .select()
      .from(agreementAcceptances)
      .where(eq(agreementAcceptances.agreementId, row.id));
    const acceptances: AgreementAcceptanceProps[] = acceptanceRows.map(
      (a) => ({
        userId: a.userId,
        acceptedAt: a.acceptedAt ? new Date(a.acceptedAt) : null,
      }),
    );
    return new Agreement({
      id: row.id,
      listingId: row.listingId,
      rulesSnapshot: row.rulesSnapshot as AgreementRuleSet,
      acceptances,
      createdAt: new Date(row.createdAt),
    });
  }
}
