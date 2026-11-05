import { and, desc, eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  modListingReviews,
  modReports,
  type ModListingReviewRow,
  type ModReportRow,
  type NewModListingReview,
  type NewModReport,
} from "../../db/schema/governance.js";
import { roomListings } from "../../db/schema/rooms.js";
import type {
  ListingReportReason,
  ListingReportRecord,
  ListingReviewRecord,
  ListingReviewStatus,
  ModerationRepository,
  ReportStatus,
} from "../../modules/moderation/index.js";
import { AppError } from "../../shared/AppError.js";

export class DrizzleModerationRepository implements ModerationRepository {
  constructor(private readonly db: MySql2Database<any>) {}

  async listingExists(listingId: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: roomListings.id })
      .from(roomListings)
      .where(eq(roomListings.id, listingId))
      .limit(1);
    return Boolean(rows[0]);
  }

  async findListingOwnerId(listingId: string): Promise<string | null> {
    const rows = await this.db
      .select({ hostId: roomListings.hostId })
      .from(roomListings)
      .where(eq(roomListings.id, listingId))
      .limit(1);
    return rows[0]?.hostId ?? null;
  }

  async hasOpenListingReport(reporterId: string, listingId: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: modReports.id })
      .from(modReports)
      .where(
        and(
          eq(modReports.reporterId, reporterId),
          eq(modReports.targetType, "listing"),
          eq(modReports.targetListingId, listingId),
          eq(modReports.status, "open"),
        ),
      )
      .limit(1);
    return Boolean(rows[0]);
  }

  async createListingReport(report: ListingReportRecord): Promise<ListingReportRecord> {
    const record: NewModReport = {
      id: report.id,
      reporterId: report.reporterId,
      targetType: "listing",
      targetListingId: report.listingId,
      reason: report.reason,
      description: report.description ?? null,
      status: report.status,
      createdAt: report.createdAt,
    };
    await this.db.insert(modReports).values(record);
    return report;
  }

  async listListingReports(status?: ReportStatus): Promise<ListingReportRecord[]> {
    const condition = status
      ? and(eq(modReports.targetType, "listing"), eq(modReports.status, status))
      : eq(modReports.targetType, "listing");
    const rows: ModReportRow[] = await this.db
      .select()
      .from(modReports)
      .where(condition)
      .orderBy(desc(modReports.createdAt));
    return rows.map((row) => this.toReport(row));
  }

  async enqueueListing(listingId: string, at: Date): Promise<ListingReviewRecord> {
    const rows: ModListingReviewRow[] = await this.db
      .select()
      .from(modListingReviews)
      .where(eq(modListingReviews.listingId, listingId))
      .limit(1);
    if (rows[0]) return this.toReview(rows[0]);
    const record: NewModListingReview = {
      listingId,
      status: "pending",
      createdAt: at,
    };
    await this.db.insert(modListingReviews).values(record);
    return {
      listingId,
      status: "pending",
      reviewerId: null,
      reason: null,
      reviewedAt: null,
      createdAt: at,
    };
  }

  async listReviews(status?: ListingReviewStatus): Promise<ListingReviewRecord[]> {
    const query = this.db.select().from(modListingReviews);
    const rows: ModListingReviewRow[] = status
      ? await query.where(eq(modListingReviews.status, status)).orderBy(desc(modListingReviews.createdAt))
      : await query.orderBy(desc(modListingReviews.reviewedAt));
    return rows.map((row) => this.toReview(row));
  }

  async decideListing(input: {
    listingId: string;
    reviewerId: string;
    status: Exclude<ListingReviewStatus, "pending">;
    reason?: string;
    at: Date;
  }): Promise<ListingReviewRecord> {
    const rows: ModListingReviewRow[] = await this.db
      .select()
      .from(modListingReviews)
      .where(eq(modListingReviews.listingId, input.listingId))
      .limit(1);
    if (!rows[0]) {
      throw new AppError("El anuncio no está en la cola de revisión.", 404, "REVIEW_NOT_FOUND");
    }
    await this.db.transaction(async (transaction) => {
      await transaction
        .update(modListingReviews)
        .set({
          status: input.status,
          reviewerId: input.reviewerId,
          reason: input.reason ?? null,
          reviewedAt: input.at,
        })
        .where(eq(modListingReviews.listingId, input.listingId));
      if (input.status === "removed") {
        await transaction
          .update(roomListings)
          .set({ status: "closed", closedAt: input.at })
          .where(eq(roomListings.id, input.listingId));
      }
    });
    return {
      listingId: input.listingId,
      status: input.status,
      reviewerId: input.reviewerId,
      reason: input.reason ?? null,
      reviewedAt: input.at,
      createdAt: new Date(rows[0].createdAt),
    };
  }

  private toReport(row: ModReportRow): ListingReportRecord {
    return {
      id: row.id,
      reporterId: row.reporterId,
      listingId: row.targetListingId!,
      reason: row.reason as ListingReportReason,
      description: row.description,
      status: row.status,
      createdAt: new Date(row.createdAt),
      resolvedAt: row.resolvedAt ? new Date(row.resolvedAt) : null,
    };
  }

  private toReview(row: ModListingReviewRow): ListingReviewRecord {
    return {
      listingId: row.listingId,
      status: row.status,
      reviewerId: row.reviewerId,
      reason: row.reason,
      reviewedAt: row.reviewedAt ? new Date(row.reviewedAt) : null,
      createdAt: new Date(row.createdAt),
    };
  }
}
