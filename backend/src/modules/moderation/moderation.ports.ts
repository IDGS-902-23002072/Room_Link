export type ListingReportReason = "fraud" | "spam" | "inappropriate" | "other";
export type ReportStatus = "open" | "in_review" | "resolved" | "dismissed";
export type ListingReviewStatus = "pending" | "approved" | "rejected" | "removed";

export interface ListingReportRecord {
  id: string;
  reporterId: string;
  listingId: string;
  reason: ListingReportReason;
  description?: string | null | undefined;
  status: ReportStatus;
  createdAt: Date;
  resolvedAt?: Date | null | undefined;
}

export interface ListingReviewRecord {
  listingId: string;
  status: ListingReviewStatus;
  reviewerId?: string | null | undefined;
  reason?: string | null | undefined;
  reviewedAt?: Date | null | undefined;
  createdAt: Date;
}

export interface ModerationRepository {
  listingExists(listingId: string): Promise<boolean>;
  findListingOwnerId(listingId: string): Promise<string | null>;
  hasOpenListingReport(reporterId: string, listingId: string): Promise<boolean>;
  createListingReport(report: ListingReportRecord): Promise<ListingReportRecord>;
  listListingReports(status?: ReportStatus): Promise<ListingReportRecord[]>;
  enqueueListing(listingId: string, at: Date): Promise<ListingReviewRecord>;
  listReviews(status?: ListingReviewStatus): Promise<ListingReviewRecord[]>;
  decideListing(input: {
    listingId: string;
    reviewerId: string;
    status: Exclude<ListingReviewStatus, "pending">;
    reason?: string;
    at: Date;
  }): Promise<ListingReviewRecord>;
}
