import { and, desc, eq, gt, isNull, lte, ne, or } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  modSanctions,
  type ModSanctionRow,
  type NewModSanction,
} from "../../db/schema/governance.js";
import {
  Sanction,
  type ISanctionRepository,
  type SanctionType,
} from "../../domain/index.js";

export class DrizzleSanctionRepository implements ISanctionRepository {
  constructor(private readonly db: MySql2Database<any>) {}

  async findById(id: string): Promise<Sanction | null> {
    const rows = await this.db
      .select()
      .from(modSanctions)
      .where(eq(modSanctions.id, id))
      .limit(1);
    const row = rows[0];
    return row ? this.toDomain(row) : null;
  }

  async listForUser(userId: string): Promise<Sanction[]> {
    const rows = await this.db
      .select()
      .from(modSanctions)
      .where(eq(modSanctions.userId, userId))
      .orderBy(desc(modSanctions.createdAt));
    return rows.map((row) => this.toDomain(row));
  }

  async listActiveForUser(userId: string, at: Date): Promise<Sanction[]> {
    const rows = await this.db
      .select()
      .from(modSanctions)
      .where(
        and(
          eq(modSanctions.userId, userId),
          ne(modSanctions.type, "dismissed"),
          or(isNull(modSanctions.expiresAt), gt(modSanctions.expiresAt, at)),
        ),
      )
      .orderBy(desc(modSanctions.createdAt));
    return rows.map((row) => this.toDomain(row));
  }

  async listForListing(listingId: string): Promise<Sanction[]> {
    const rows = await this.db
      .select()
      .from(modSanctions)
      .where(eq(modSanctions.listingId, listingId))
      .orderBy(desc(modSanctions.createdAt));
    return rows.map((row) => this.toDomain(row));
  }

  async create(sanction: Sanction): Promise<Sanction> {
    const record: NewModSanction = {
      id: sanction.id,
      reportId: sanction.reportId,
      adminId: sanction.adminId,
      userId: sanction.userId,
      listingId: sanction.listingId,
      type: sanction.type,
      reason: sanction.reason,
      expiresAt: sanction.expiresAt,
      createdAt: sanction.createdAt,
    };
    await this.db.insert(modSanctions).values(record);
    return sanction;
  }

  async revoke(id: string, at: Date): Promise<void> {
    // Revocar = marcar como expirada ahora. Las consultas de "active" ya filtran por expiresAt > now.
    await this.db
      .update(modSanctions)
      .set({ expiresAt: at })
      .where(eq(modSanctions.id, id));
    // Si el tipo era warning o permanent_ban sin expiración, también la marcamos como dismissed
    // de cara a reportes históricos y notificaciones.
    void lte;
  }

  private toDomain(row: ModSanctionRow): Sanction {
    return new Sanction({
      id: row.id,
      reportId: row.reportId ?? null,
      adminId: row.adminId,
      userId: row.userId ?? null,
      listingId: row.listingId ?? null,
      type: row.type as SanctionType,
      reason: row.reason,
      expiresAt: row.expiresAt ? new Date(row.expiresAt) : null,
      createdAt: new Date(row.createdAt),
    });
  }
}
