import { randomUUID } from "node:crypto";
import { AppError } from "../../shared/AppError.js";
import type { DomainEventPublisher } from "../auth/index.js";
import type {
  ListingReportReason,
  ListingReportRecord,
  ListingReviewRecord,
  ListingReviewStatus,
  ModerationRepository,
  ReportStatus,
} from "./moderation.ports.js";

const listingReasons = new Set<ListingReportReason>(["fraud", "spam", "inappropriate", "other"]);
const decisions = new Set<ListingReviewStatus>(["approved", "rejected", "removed"]);

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
