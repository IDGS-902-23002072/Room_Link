import { randomUUID } from "node:crypto";
import { AppError } from "../../shared/AppError.js";
import type { DomainEventPublisher } from "../auth/index.js";
import {
  reportReasons as allReportReasons,
  type AnyReportRecord,
  type ListingReportReason,
  type ListingReportRecord,
  type ListingReviewRecord,
  type ListingReviewStatus,
  type MessageReportRecord,
  type ModerationRepository,
  type ReportReason,
  type ReportStatus,
  type ReportTargetType,
  type UserReportRecord,
} from "./moderation.ports.js";

const listingReasons = new Set<ListingReportReason>(["fraud", "spam", "inappropriate", "other"]);
const generalReasons = new Set<ReportReason>(allReportReasons);
const decisions = new Set<ListingReviewStatus>(["approved", "rejected", "removed"]);
const resolutions = new Set<"resolved" | "dismissed">(["resolved", "dismissed"]);

export class ModerationService {
  constructor(
    private readonly repository: ModerationRepository,
    private readonly events: DomainEventPublisher,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async reportListing(input: {
    reporterId: string;
    listingId: string;
    reason: ListingReportReason;
    description?: string;
  }): Promise<ListingReportRecord> {
    if (!listingReasons.has(input.reason)) {
      throw new AppError("Motivo de denuncia inválido.", 400, "INVALID_REPORT_REASON");
    }
    if (!(await this.repository.listingExists(input.listingId))) {
      throw new AppError("Anuncio no encontrado.", 404, "LISTING_NOT_FOUND");
    }
    if ((await this.repository.findListingOwnerId(input.listingId)) === input.reporterId) {
      throw new AppError("No puedes denunciar tu propio anuncio.", 400, "SELF_REPORT_NOT_ALLOWED");
    }
    if (await this.repository.hasOpenListingReport(input.reporterId, input.listingId)) {
      throw new AppError("Ya existe una denuncia abierta para este anuncio.", 409, "DUPLICATE_REPORT");
    }
    const description = input.description?.trim();
    if (description && description.length > 2000) {
      throw new AppError(
        "La descripción no puede exceder 2000 caracteres.",
        400,
        "REPORT_DESCRIPTION_TOO_LONG",
      );
    }
    return this.repository.createListingReport({
      id: randomUUID(),
      reporterId: input.reporterId,
      listingId: input.listingId,
      reason: input.reason,
      description: description || null,
      status: "open",
      createdAt: this.now(),
    });
  }

  listReports(status?: ReportStatus): Promise<ListingReportRecord[]> {
    return this.repository.listListingReports(status);
  }

  async reportUser(input: {
    reporterId: string;
    targetUserId: string;
    reason: ReportReason;
    description?: string;
  }): Promise<UserReportRecord> {
    if (!generalReasons.has(input.reason)) {
      throw new AppError("Motivo de denuncia inválido.", 400, "INVALID_REPORT_REASON");
    }
    if (input.reporterId === input.targetUserId) {
      throw new AppError("No puedes denunciarte a ti mismo.", 400, "SELF_REPORT_NOT_ALLOWED");
    }
    if (!(await this.repository.userExists(input.targetUserId))) {
      throw new AppError("Usuario no encontrado.", 404, "USER_NOT_FOUND");
    }
    if (await this.repository.hasOpenUserReport(input.reporterId, input.targetUserId)) {
      throw new AppError(
        "Ya existe una denuncia abierta para este usuario.",
        409,
        "DUPLICATE_REPORT",
      );
    }
    const description = this.normalizeDescription(input.description);
    return this.repository.createUserReport({
      id: randomUUID(),
      reporterId: input.reporterId,
      targetUserId: input.targetUserId,
      reason: input.reason,
      description: description ?? null,
      status: "open",
      createdAt: this.now(),
    });
  }

  async reportMessage(input: {
    reporterId: string;
    targetMessageId: number;
    reason: ReportReason;
    description?: string;
  }): Promise<MessageReportRecord> {
    if (!generalReasons.has(input.reason)) {
      throw new AppError("Motivo de denuncia inválido.", 400, "INVALID_REPORT_REASON");
    }
    if (!Number.isInteger(input.targetMessageId) || input.targetMessageId <= 0) {
      throw new AppError("Identificador de mensaje inválido.", 400, "INVALID_MESSAGE_ID");
    }
    const roomId = await this.repository.getMessageRoomId(input.targetMessageId);
    if (!roomId) {
      throw new AppError("Mensaje no encontrado.", 404, "MESSAGE_NOT_FOUND");
    }
    // Solo quien participó del chat puede denunciar un mensaje de esa sala.
    if (!(await this.repository.isRoomMember(roomId, input.reporterId))) {
      throw new AppError(
        "Solo los miembros del chat pueden denunciar sus mensajes.",
        403,
        "MESSAGE_REPORT_FORBIDDEN",
      );
    }
    if (await this.repository.hasOpenMessageReport(input.reporterId, input.targetMessageId)) {
      throw new AppError(
        "Ya existe una denuncia abierta para este mensaje.",
        409,
        "DUPLICATE_REPORT",
      );
    }
    const description = this.normalizeDescription(input.description);
    return this.repository.createMessageReport({
      id: randomUUID(),
      reporterId: input.reporterId,
      targetMessageId: input.targetMessageId,
      reason: input.reason,
      description: description ?? null,
      status: "open",
      createdAt: this.now(),
    });
  }

  listAllReports(filter: {
    targetType?: ReportTargetType;
    status?: ReportStatus;
  } = {}): Promise<AnyReportRecord[]> {
    return this.repository.listReports(filter);
  }

  async resolveReport(input: {
    reportId: string;
    status: "resolved" | "dismissed";
  }): Promise<AnyReportRecord> {
    if (!resolutions.has(input.status)) {
      throw new AppError("Resolución inválida.", 400, "INVALID_REPORT_RESOLUTION");
    }
    const report = await this.repository.findReportById(input.reportId);
    if (!report) {
      throw new AppError("Denuncia no encontrada.", 404, "REPORT_NOT_FOUND");
    }
    if (report.status !== "open" && report.status !== "in_review") {
      throw new AppError(
        `La denuncia ya fue resuelta (${report.status}).`,
        409,
        "REPORT_ALREADY_RESOLVED",
      );
    }
    return this.repository.resolveReport({
      id: input.reportId,
      status: input.status,
      at: this.now(),
    });
  }

  private normalizeDescription(description?: string): string | null {
    if (!description) return null;
    const trimmed = description.trim();
    if (!trimmed) return null;
    if (trimmed.length > 2000) {
      throw new AppError(
        "La descripción no puede exceder 2000 caracteres.",
        400,
        "REPORT_DESCRIPTION_TOO_LONG",
      );
    }
    return trimmed;
  }

  async enqueueListing(listingId: string): Promise<ListingReviewRecord> {
    if (!(await this.repository.listingExists(listingId))) {
      throw new AppError("Anuncio no encontrado.", 404, "LISTING_NOT_FOUND");
    }
    return this.repository.enqueueListing(listingId, this.now());
  }

  listQueue(status: ListingReviewStatus = "pending"): Promise<ListingReviewRecord[]> {
    return this.repository.listReviews(status);
  }

  async listHistory(): Promise<ListingReviewRecord[]> {
    return (await this.repository.listReviews()).filter((review) => review.status !== "pending");
  }

  async decideListing(input: {
    listingId: string;
    reviewerId: string;
    decision: Exclude<ListingReviewStatus, "pending">;
    reason?: string;
  }): Promise<ListingReviewRecord> {
    if (!decisions.has(input.decision)) {
      throw new AppError("Decisión de moderación inválida.", 400, "INVALID_REVIEW_DECISION");
    }
    const reason = input.reason?.trim();
    if (input.decision !== "approved" && !reason) {
      throw new AppError(
        "El rechazo o la baja requieren un motivo.",
        400,
        "REVIEW_REASON_REQUIRED",
      );
    }
    const reviewed = await this.repository.decideListing({
      listingId: input.listingId,
      reviewerId: input.reviewerId,
      status: input.decision,
      ...(reason ? { reason } : {}),
      at: this.now(),
    });
    await this.events.publish({
      type: "ListingModeratedEvent",
      aggregateId: input.listingId,
      payload: {
        listingId: input.listingId,
        reviewerId: input.reviewerId,
        status: input.decision,
        reason: reason ?? null,
      },
    });
    return reviewed;
  }
}
