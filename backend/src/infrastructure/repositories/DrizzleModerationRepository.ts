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
import { authUsers } from "../../db/schema/auth.js";
import { roomListings } from "../../db/schema/rooms.js";
import { chatMessages, chatRoomMembers } from "../../db/schema/social.js";
import type {
  AnyReportRecord,
  ListingReportReason,
  ListingReportRecord,
  ListingReviewRecord,
  ListingReviewStatus,
  MessageReportRecord,
  ModerationRepository,
  ReportReason,
  ReportStatus,
  ReportTargetType,
  UserReportRecord,
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

  async userExists(userId: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: authUsers.id })
      .from(authUsers)
      .where(eq(authUsers.id, userId))
      .limit(1);
    return Boolean(rows[0]);
  }

  async hasOpenUserReport(reporterId: string, targetUserId: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: modReports.id })
      .from(modReports)
      .where(
        and(
          eq(modReports.reporterId, reporterId),
          eq(modReports.targetType, "user"),
          eq(modReports.targetUserId, targetUserId),
          eq(modReports.status, "open"),
        ),
      )
      .limit(1);
    return Boolean(rows[0]);
  }

  async createUserReport(report: UserReportRecord): Promise<UserReportRecord> {
    const record: NewModReport = {
      id: report.id,
      reporterId: report.reporterId,
      targetType: "user",
      targetUserId: report.targetUserId,
      reason: report.reason,
      description: report.description ?? null,
      status: report.status,
      createdAt: report.createdAt,
    };
    await this.db.insert(modReports).values(record);
    return report;
  }

  async getMessageRoomId(messageId: number): Promise<string | null> {
    const rows = await this.db
      .select({ roomId: chatMessages.roomId })
      .from(chatMessages)
      .where(eq(chatMessages.id, messageId))
      .limit(1);
    return rows[0]?.roomId ?? null;
  }

  async isRoomMember(roomId: string, userId: string): Promise<boolean> {
    const rows = await this.db
      .select({ userId: chatRoomMembers.userId })
      .from(chatRoomMembers)
      .where(
        and(eq(chatRoomMembers.roomId, roomId), eq(chatRoomMembers.userId, userId)),
      )
      .limit(1);
    return Boolean(rows[0]);
  }

  async hasOpenMessageReport(reporterId: string, targetMessageId: number): Promise<boolean> {
    const rows = await this.db
      .select({ id: modReports.id })
      .from(modReports)
      .where(
        and(
          eq(modReports.reporterId, reporterId),
          eq(modReports.targetType, "message"),
          eq(modReports.targetMessageId, targetMessageId),
          eq(modReports.status, "open"),
        ),
      )
      .limit(1);
    return Boolean(rows[0]);
  }

  async createMessageReport(report: MessageReportRecord): Promise<MessageReportRecord> {
    const record: NewModReport = {
      id: report.id,
      reporterId: report.reporterId,
      targetType: "message",
      targetMessageId: report.targetMessageId,
      reason: report.reason,
      description: report.description ?? null,
      status: report.status,
      createdAt: report.createdAt,
    };
    await this.db.insert(modReports).values(record);
    return report;
  }

  async listReports(input: {
    targetType?: ReportTargetType;
    status?: ReportStatus;
  } = {}): Promise<AnyReportRecord[]> {
    const conditions = [] as any[];
    if (input.targetType) conditions.push(eq(modReports.targetType, input.targetType));
    if (input.status) conditions.push(eq(modReports.status, input.status));
    const query = this.db.select().from(modReports);
    const rows: ModReportRow[] = conditions.length
      ? await query.where(and(...conditions)).orderBy(desc(modReports.createdAt))
      : await query.orderBy(desc(modReports.createdAt));
    return rows.map((row) => this.toAnyReport(row));
  }

  async findReportById(id: string): Promise<AnyReportRecord | null> {
    const rows = await this.db
      .select()
      .from(modReports)
      .where(eq(modReports.id, id))
      .limit(1);
    const row = rows[0];
    return row ? this.toAnyReport(row) : null;
  }

  async resolveReport(input: {
    id: string;
    status: "resolved" | "dismissed";
    at: Date;
  }): Promise<AnyReportRecord> {
    await this.db
      .update(modReports)
      .set({ status: input.status, resolvedAt: input.at })
      .where(eq(modReports.id, input.id));
    const found = await this.findReportById(input.id);
    if (!found) {
      throw new AppError("Denuncia no encontrada tras actualizar.", 404, "REPORT_NOT_FOUND");
    }
    return found;
  }

  private toAnyReport(row: ModReportRow): AnyReportRecord {
    return {
      id: row.id,
      reporterId: row.reporterId,
      targetType: row.targetType as ReportTargetType,
      targetListingId: row.targetListingId ?? null,
      targetUserId: row.targetUserId ?? null,
      targetMessageId: row.targetMessageId ?? null,
      reason: row.reason as ReportReason,
      description: row.description ?? null,
      status: row.status as ReportStatus,
      createdAt: new Date(row.createdAt),
      resolvedAt: row.resolvedAt ? new Date(row.resolvedAt) : null,
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
