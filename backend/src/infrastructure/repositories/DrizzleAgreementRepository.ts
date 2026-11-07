import { and, desc, eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  agreementAcceptances,
  agreementAgreements,
} from "../../db/schema/governance.js";
import {
  Agreement,
  AgreementAcceptance,
  type IAgreementRepository,
} from "../../domain/index.js";

export class DrizzleAgreementRepository implements IAgreementRepository {
  constructor(private readonly db: MySql2Database<any>) {}

  async findById(id: string): Promise<Agreement | null> {
    const rows = await this.db
      .select()
      .from(agreementAgreements)
      .where(eq(agreementAgreements.id, id))
      .limit(1);
    const row = rows[0];
    return row
      ? new Agreement({
          id: row.id,
          listingId: row.listingId,
          rulesSnapshot: (row.rulesSnapshot ?? {}) as Record<string, unknown>,
          createdAt: new Date(row.createdAt),
        })
      : null;
  }

  async listByListingId(listingId: string): Promise<Agreement[]> {
    const rows = await this.db
      .select()
      .from(agreementAgreements)
      .where(eq(agreementAgreements.listingId, listingId))
      .orderBy(desc(agreementAgreements.createdAt));
    return rows.map(
      (row) =>
        new Agreement({
          id: row.id,
          listingId: row.listingId,
          rulesSnapshot: (row.rulesSnapshot ?? {}) as Record<string, unknown>,
          createdAt: new Date(row.createdAt),
        }),
    );
  }

  async create(agreement: Agreement): Promise<Agreement> {
    await this.db.insert(agreementAgreements).values({
      id: agreement.id,
      listingId: agreement.listingId,
      rulesSnapshot: agreement.rulesSnapshot,
      createdAt: agreement.createdAt,
    });
    return agreement;
  }

  async findAcceptance(agreementId: string, userId: string): Promise<AgreementAcceptance | null> {
    const rows = await this.db
      .select()
      .from(agreementAcceptances)
      .where(
        and(
          eq(agreementAcceptances.agreementId, agreementId),
          eq(agreementAcceptances.userId, userId),
        ),
      )
      .limit(1);
    const row = rows[0];
    return row
      ? new AgreementAcceptance({
          agreementId: row.agreementId,
          userId: row.userId,
          acceptedAt: row.acceptedAt ? new Date(row.acceptedAt) : null,
        })
      : null;
  }

  async listAcceptances(agreementId: string): Promise<AgreementAcceptance[]> {
    const rows = await this.db
      .select()
      .from(agreementAcceptances)
      .where(eq(agreementAcceptances.agreementId, agreementId));
    return rows.map(
      (row) =>
        new AgreementAcceptance({
          agreementId: row.agreementId,
          userId: row.userId,
          acceptedAt: row.acceptedAt ? new Date(row.acceptedAt) : null,
        }),
    );
  }

  async upsertAcceptance(acceptance: AgreementAcceptance): Promise<AgreementAcceptance> {
    const existing = await this.findAcceptance(acceptance.agreementId, acceptance.userId);
    if (existing) {
      await this.db
        .update(agreementAcceptances)
        .set({ acceptedAt: acceptance.acceptedAt })
        .where(
          and(
            eq(agreementAcceptances.agreementId, acceptance.agreementId),
            eq(agreementAcceptances.userId, acceptance.userId),
          ),
        );
    } else {
      await this.db.insert(agreementAcceptances).values({
        agreementId: acceptance.agreementId,
        userId: acceptance.userId,
        acceptedAt: acceptance.acceptedAt,
      });
    }
    return acceptance;
  }
}
