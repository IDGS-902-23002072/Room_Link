import { describe, expect, it } from "vitest";
import {
  ModerationService,
  type ListingReportRecord,
  type ListingReviewRecord,
  type ListingReviewStatus,
  type ModerationRepository,
  type ReportStatus,
} from "../../src/modules/moderation/index.js";

class InMemoryModerationRepository implements ModerationRepository {
  readonly owners = new Map([["listing-1", "owner-1"]]);
  readonly reports: ListingReportRecord[] = [];
  readonly reviews = new Map<string, ListingReviewRecord>();

  async listingExists(listingId: string): Promise<boolean> {
    return this.owners.has(listingId);
  }

  async findListingOwnerId(listingId: string): Promise<string | null> {
    return this.owners.get(listingId) ?? null;
  }

  async hasOpenListingReport(reporterId: string, listingId: string): Promise<boolean> {
    return this.reports.some(
      (report) =>
        report.reporterId === reporterId &&
        report.listingId === listingId &&
        report.status === "open",
    );
  }

  async createListingReport(report: ListingReportRecord): Promise<ListingReportRecord> {
    this.reports.push(report);
    return report;
  }

  async listListingReports(status?: ReportStatus): Promise<ListingReportRecord[]> {
    return this.reports.filter((report) => !status || report.status === status);
  }

  async enqueueListing(listingId: string, at: Date): Promise<ListingReviewRecord> {
    const existing = this.reviews.get(listingId);
    if (existing) return existing;
    const review: ListingReviewRecord = { listingId, status: "pending", createdAt: at };
    this.reviews.set(listingId, review);
    return review;
  }

  async listReviews(status?: ListingReviewStatus): Promise<ListingReviewRecord[]> {
    return [...this.reviews.values()].filter((review) => !status || review.status === status);
  }

  async decideListing(input: {
    listingId: string;
    reviewerId: string;
    status: Exclude<ListingReviewStatus, "pending">;
    reason?: string;
    at: Date;
  }): Promise<ListingReviewRecord> {
    const current = this.reviews.get(input.listingId);
    if (!current) throw new Error("missing review");
    const reviewed: ListingReviewRecord = {
      ...current,
      status: input.status,
      reviewerId: input.reviewerId,
      reason: input.reason ?? null,
      reviewedAt: input.at,
    };
    this.reviews.set(input.listingId, reviewed);
    return reviewed;
  }
}

const createService = () => {
  const repository = new InMemoryModerationRepository();
  const events: Array<{ type: string; aggregateId: string }> = [];
  const service = new ModerationService(
    repository,
    { publish: async (event) => void events.push(event) },
    () => new Date("2026-11-05T12:00:00.000Z"),
  );
  return { repository, events, service };
};

describe("ModerationService", () => {
  it("accepts a valid listing report", async () => {
    const { repository, service } = createService();

    await expect(
      service.reportListing({
        reporterId: "reporter-1",
        listingId: "listing-1",
        reason: "fraud",
        description: " Datos inconsistentes ",
      }),
    ).resolves.toMatchObject({
      reporterId: "reporter-1",
      listingId: "listing-1",
      description: "Datos inconsistentes",
      status: "open",
    });
    expect(repository.reports).toHaveLength(1);
  });

  it("rejects self-reports and duplicate open reports", async () => {
    const { service } = createService();

    await expect(
      service.reportListing({ reporterId: "owner-1", listingId: "listing-1", reason: "spam" }),
    ).rejects.toMatchObject({ code: "SELF_REPORT_NOT_ALLOWED" });

    await service.reportListing({
      reporterId: "reporter-1",
      listingId: "listing-1",
      reason: "spam",
    });
    await expect(
      service.reportListing({
        reporterId: "reporter-1",
        listingId: "listing-1",
        reason: "fraud",
      }),
    ).rejects.toMatchObject({ code: "DUPLICATE_REPORT" });
  });

  it("requires a reason for rejected or removed listings", async () => {
    const { repository, service } = createService();
    await repository.enqueueListing("listing-1", new Date());

    await expect(
      service.decideListing({
        listingId: "listing-1",
        reviewerId: "admin-1",
        decision: "rejected",
      }),
    ).rejects.toMatchObject({ code: "REVIEW_REASON_REQUIRED" });
  });

  it("records moderation history and publishes an event", async () => {
    const { events, repository, service } = createService();
    await service.enqueueListing("listing-1");

    await service.decideListing({
      listingId: "listing-1",
      reviewerId: "admin-1",
      decision: "removed",
      reason: "Contenido fraudulento",
    });

    await expect(service.listHistory()).resolves.toMatchObject([
      { listingId: "listing-1", status: "removed", reviewerId: "admin-1" },
    ]);
    expect(repository.reviews.get("listing-1")?.reason).toBe("Contenido fraudulento");
    expect(events).toMatchObject([
      {
        type: "ListingModeratedEvent",
        aggregateId: "listing-1",
        payload: { status: "removed", reason: "Contenido fraudulento" },
      },
    ]);
  });
});
