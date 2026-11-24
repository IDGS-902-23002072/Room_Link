import { and, eq } from "drizzle-orm";
import { AppError } from "../../shared/AppError.js";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { Application, type IApplicationRepository } from "../../domain/index.js";
import {
  appApplications,
  type AppApplicationRow,
  type NewAppApplication,
} from "../../db/schema/social.js";

export class DrizzleApplicationRepository implements IApplicationRepository {
  constructor(private db: MySql2Database<any>) {}

  async findById(id: string): Promise<Application | null> {
    const rows: AppApplicationRow[] = await this.db
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
    const rows: AppApplicationRow[] = await this.db
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
    const rows: AppApplicationRow[] = await this.db
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
    const newRecord: NewAppApplication = {
      id: app.id,
      listingId: app.listingId,
      applicantId: app.applicantId,
      status: app.status,
      message: app.message ?? null,
      compatibilityScore: app.compatibilityScore ? app.compatibilityScore.toFixed(2) : null,
    };

    try {
      await this.db.insert(appApplications).values(newRecord);
    } catch (error) {
      const cause = (error as { cause?: { code?: string } })?.cause ?? (error as { code?: string });
      if (cause?.code === "ER_SIGNAL_EXCEPTION") {
        throw new AppError("Solo puedes postularte a anuncios publicados de otros anfitriones.");
      }
      if (cause?.code === "ER_DUP_ENTRY") {
        const [existing] = await this.db.select({ id: appApplications.id })
          .from(appApplications)
          .where(and(eq(appApplications.listingId, app.listingId), eq(appApplications.applicantId, app.applicantId)))
          .limit(1);
        if (existing) {
          throw new AppError("Ya enviaste una postulación a esta habitación.", 409, "APPLICATION_ALREADY_SENT");
        }
      }
      throw error;
    }
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
