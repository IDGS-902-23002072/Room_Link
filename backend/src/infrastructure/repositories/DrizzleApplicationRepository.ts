import { eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { Application, type IApplicationRepository } from "../../domain/index.js";
import { appApplications } from "../../db/schema/social.js";

export class DrizzleApplicationRepository implements IApplicationRepository {
  constructor(private db: MySql2Database<any>) {}

  async findById(id: string): Promise<Application | null> {
    const rows = await this.db
      .select()
      .from(appApplications)
      .where(eq(appApplications.id, id))
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    return new Application({
      id: row.id,
      listingId: row.listingId,
      applicantId: row.applicantId,
      status: row.status,
      message: row.message,
      compatibilityScore: row.compatibilityScore ? Number(row.compatibilityScore) : null,
      createdAt: new Date(row.createdAt),
      decidedAt: row.decidedAt ? new Date(row.decidedAt) : null,
    });
  }

  async findByListingId(listingId: string): Promise<Application[]> {
    const rows = await this.db
      .select()
      .from(appApplications)
      .where(eq(appApplications.listingId, listingId));

    return rows.map(
      (row) =>
        new Application({
          id: row.id,
          listingId: row.listingId,
          applicantId: row.applicantId,
          status: row.status,
          message: row.message,
          compatibilityScore: row.compatibilityScore ? Number(row.compatibilityScore) : null,
          createdAt: new Date(row.createdAt),
          decidedAt: row.decidedAt ? new Date(row.decidedAt) : null,
        }),
    );
  }

  async findByApplicantId(applicantId: string): Promise<Application[]> {
    const rows = await this.db
      .select()
      .from(appApplications)
      .where(eq(appApplications.applicantId, applicantId));

    return rows.map(
      (row) =>
        new Application({
          id: row.id,
          listingId: row.listingId,
          applicantId: row.applicantId,
          status: row.status,
          message: row.message,
          compatibilityScore: row.compatibilityScore ? Number(row.compatibilityScore) : null,
          createdAt: new Date(row.createdAt),
          decidedAt: row.decidedAt ? new Date(row.decidedAt) : null,
        }),
    );
  }

  async create(app: Application): Promise<Application> {
    await this.db.insert(appApplications).values({
      id: app.id,
      listingId: app.listingId,
      applicantId: app.applicantId,
      status: app.status,
      message: app.message ?? null,
      compatibilityScore: app.compatibilityScore ? app.compatibilityScore.toFixed(2) : null,
    });
    return app;
  }

  async update(app: Application): Promise<void> {
    await this.db
      .update(appApplications)
      .set({
        status: app.status,
        decidedAt: new Date(),
      })
      .where(eq(appApplications.id, app.id));
  }
}
