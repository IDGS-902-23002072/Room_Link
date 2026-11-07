import { describe, expect, it } from "vitest";
import {
  ModerationService,
  type AnyReportRecord,
  type ListingReportRecord,
  type ListingReviewRecord,
  type ListingReviewStatus,
  type MessageReportRecord,
  type ModerationRepository,
  type ReportStatus,
  type ReportTargetType,
  type UserReportRecord,
} from "../../src/modules/moderation/index.js";

class InMemoryModerationRepository implements ModerationRepository {
  readonly owners = new Map([["listing-1", "owner-1"]]);
  readonly users = new Set<string>(["owner-1", "reporter-1", "target-1"]);
  readonly roomMembers = new Map<string, Set<string>>();
  readonly messagesByRoom = new Map<number, string>();
  readonly reports: ListingReportRecord[] = [];
  readonly userReports: UserReportRecord[] = [];
  readonly messageReports: MessageReportRecord[] = [];
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

  async userExists(userId: string): Promise<boolean> {
    return this.users.has(userId);
  }

  async hasOpenUserReport(reporterId: string, targetUserId: string): Promise<boolean> {
    return this.userReports.some(
      (r) =>
        r.reporterId === reporterId &&
        r.targetUserId === targetUserId &&
        r.status === "open",
    );
  }

  async createUserReport(report: UserReportRecord): Promise<UserReportRecord> {
    this.userReports.push(report);
    return report;
  }

  async getMessageRoomId(messageId: number): Promise<string | null> {
    return this.messagesByRoom.get(messageId) ?? null;
  }

  async isRoomMember(roomId: string, userId: string): Promise<boolean> {
    return this.roomMembers.get(roomId)?.has(userId) ?? false;
  }

  async hasOpenMessageReport(reporterId: string, targetMessageId: number): Promise<boolean> {
    return this.messageReports.some(
      (r) =>
        r.reporterId === reporterId &&
        r.targetMessageId === targetMessageId &&
        r.status === "open",
    );
  }

  async createMessageReport(report: MessageReportRecord): Promise<MessageReportRecord> {
    this.messageReports.push(report);
    return report;
  }

  async listReports(input: {
    targetType?: ReportTargetType;
    status?: ReportStatus;
  } = {}): Promise<AnyReportRecord[]> {
    const all: AnyReportRecord[] = [
      ...this.reports.map((r) => ({
        id: r.id,
        reporterId: r.reporterId,
        targetType: "listing" as ReportTargetType,
        targetListingId: r.listingId,
        targetUserId: null,
        targetMessageId: null,
        reason: r.reason,
        description: r.description ?? null,
        status: r.status,
        createdAt: r.createdAt,
        resolvedAt: r.resolvedAt ?? null,
      })),
      ...this.userReports.map((r) => ({
        id: r.id,
        reporterId: r.reporterId,
        targetType: "user" as ReportTargetType,
        targetListingId: null,
        targetUserId: r.targetUserId,
        targetMessageId: null,
        reason: r.reason,
        description: r.description ?? null,
        status: r.status,
        createdAt: r.createdAt,
        resolvedAt: r.resolvedAt ?? null,
      })),
      ...this.messageReports.map((r) => ({
        id: r.id,
        reporterId: r.reporterId,
        targetType: "message" as ReportTargetType,
        targetListingId: null,
        targetUserId: null,
        targetMessageId: r.targetMessageId,
        reason: r.reason,
        description: r.description ?? null,
        status: r.status,
        createdAt: r.createdAt,
        resolvedAt: r.resolvedAt ?? null,
      })),
    ];
    return all.filter(
      (r) =>
        (!input.targetType || r.targetType === input.targetType) &&
        (!input.status || r.status === input.status),
    );
  }

  async findReportById(id: string): Promise<AnyReportRecord | null> {
    const all = await this.listReports();
    return all.find((r) => r.id === id) ?? null;
  }

  async resolveReport(input: {
    id: string;
    status: "resolved" | "dismissed";
    at: Date;
  }): Promise<AnyReportRecord> {
    const buckets = [this.reports, this.userReports, this.messageReports] as const;
    for (const bucket of buckets) {
      const found = (bucket as Array<{ id: string; status: ReportStatus; resolvedAt?: Date | null }>).find(
        (r) => r.id === input.id,
      );
      if (found) {
        found.status = input.status;
        found.resolvedAt = input.at;
      }
    }
    const result = await this.findReportById(input.id);
    if (!result) throw new Error("missing report");
    return result;
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

  describe("user reports", () => {
    it("accepts a valid user report", async () => {
      const { repository, service } = createService();
      await expect(
        service.reportUser({
          reporterId: "reporter-1",
          targetUserId: "target-1",
          reason: "harassment",
          description: "Me acosó varias veces",
        }),
      ).resolves.toMatchObject({
        targetUserId: "target-1",
        reason: "harassment",
        status: "open",
      });
      expect(repository.userReports).toHaveLength(1);
    });

    it("rejects self-report, missing user and duplicate", async () => {
      const { service } = createService();
      await expect(
        service.reportUser({
          reporterId: "reporter-1",
          targetUserId: "reporter-1",
          reason: "spam",
        }),
      ).rejects.toMatchObject({ code: "SELF_REPORT_NOT_ALLOWED" });
      await expect(
        service.reportUser({
          reporterId: "reporter-1",
          targetUserId: "nope",
          reason: "spam",
        }),
      ).rejects.toMatchObject({ code: "USER_NOT_FOUND" });

      await service.reportUser({
        reporterId: "reporter-1",
        targetUserId: "target-1",
        reason: "spam",
      });
      await expect(
        service.reportUser({
          reporterId: "reporter-1",
          targetUserId: "target-1",
          reason: "inappropriate",
        }),
      ).rejects.toMatchObject({ code: "DUPLICATE_REPORT" });
    });
  });

  describe("message reports", () => {
    it("rejects when the message does not exist", async () => {
      const { service } = createService();
      await expect(
        service.reportMessage({
          reporterId: "reporter-1",
          targetMessageId: 999,
          reason: "harassment",
        }),
      ).rejects.toMatchObject({ code: "MESSAGE_NOT_FOUND" });
    });

    it("rejects when the reporter is not a member of the room", async () => {
      const { repository, service } = createService();
      repository.messagesByRoom.set(42, "room-1");
      repository.roomMembers.set("room-1", new Set(["other-user"]));
      await expect(
        service.reportMessage({
          reporterId: "reporter-1",
          targetMessageId: 42,
          reason: "harassment",
        }),
      ).rejects.toMatchObject({ code: "MESSAGE_REPORT_FORBIDDEN" });
    });

    it("creates the report when the reporter is a room member", async () => {
      const { repository, service } = createService();
      repository.messagesByRoom.set(42, "room-1");
      repository.roomMembers.set("room-1", new Set(["reporter-1"]));
      const report = await service.reportMessage({
        reporterId: "reporter-1",
        targetMessageId: 42,
        reason: "harassment",
        description: "Lenguaje agresivo",
      });
      expect(report.targetMessageId).toBe(42);
      expect(repository.messageReports).toHaveLength(1);
    });

    it("rejects non-integer messageId", async () => {
      const { service } = createService();
      await expect(
        service.reportMessage({
          reporterId: "reporter-1",
          targetMessageId: Number.NaN,
          reason: "spam",
        }),
      ).rejects.toMatchObject({ code: "INVALID_MESSAGE_ID" });
    });
  });

  describe("resolveReport", () => {
    it("transitions open → resolved and refuses double resolution", async () => {
      const { repository, service } = createService();
      await service.reportListing({
        reporterId: "reporter-1",
        listingId: "listing-1",
        reason: "fraud",
      });
      const reportId = repository.reports[0]!.id;

      const resolved = await service.resolveReport({ reportId, status: "resolved" });
      expect(resolved.status).toBe("resolved");

      await expect(
        service.resolveReport({ reportId, status: "dismissed" }),
      ).rejects.toMatchObject({ code: "REPORT_ALREADY_RESOLVED" });
    });

    it("returns 404 when the report does not exist", async () => {
      const { service } = createService();
      await expect(
        service.resolveReport({ reportId: "nope", status: "resolved" }),
      ).rejects.toMatchObject({ code: "REPORT_NOT_FOUND" });
    });
  });

  describe("listAllReports", () => {
    it("filters by targetType", async () => {
      const { repository, service } = createService();
      await service.reportListing({
        reporterId: "reporter-1",
        listingId: "listing-1",
        reason: "spam",
      });
      repository.messagesByRoom.set(10, "room-1");
      repository.roomMembers.set("room-1", new Set(["reporter-1"]));
      await service.reportMessage({
        reporterId: "reporter-1",
        targetMessageId: 10,
        reason: "harassment",
      });

      const listings = await service.listAllReports({ targetType: "listing" });
      const messages = await service.listAllReports({ targetType: "message" });
      expect(listings.every((r) => r.targetType === "listing")).toBe(true);
      expect(messages.every((r) => r.targetType === "message")).toBe(true);
      expect(listings).toHaveLength(1);
      expect(messages).toHaveLength(1);
    });
  });
});
