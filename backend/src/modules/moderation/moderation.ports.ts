export const reportReasons = [
  "fraud",
  "harassment",
  "spam",
  "inappropriate",
  "fake_profile",
  "other",
] as const;
export type ReportReason = (typeof reportReasons)[number];

/** Motivos permitidos en denuncias de ANUNCIOS (se mantiene como subconjunto). */
export type ListingReportReason = "fraud" | "spam" | "inappropriate" | "other";

export type ReportStatus = "open" | "in_review" | "resolved" | "dismissed";
export type ReportTargetType = "listing" | "user" | "message";
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

export interface UserReportRecord {
  id: string;
  reporterId: string;
  targetUserId: string;
  reason: ReportReason;
  description?: string | null | undefined;
  status: ReportStatus;
  createdAt: Date;
  resolvedAt?: Date | null | undefined;
}

export interface MessageReportRecord {
  id: string;
  reporterId: string;
  targetMessageId: number;
  reason: ReportReason;
  description?: string | null | undefined;
  status: ReportStatus;
  createdAt: Date;
  resolvedAt?: Date | null | undefined;
}

export interface AnyReportRecord {
  id: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetListingId: string | null;
  targetUserId: string | null;
  targetMessageId: number | null;
  reason: ReportReason;
  description: string | null;
  status: ReportStatus;
  createdAt: Date;
  resolvedAt: Date | null;
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
  // Listings (compat)
  listingExists(listingId: string): Promise<boolean>;
  findListingOwnerId(listingId: string): Promise<string | null>;
  hasOpenListingReport(reporterId: string, listingId: string): Promise<boolean>;
  createListingReport(report: ListingReportRecord): Promise<ListingReportRecord>;
  listListingReports(status?: ReportStatus): Promise<ListingReportRecord[]>;

  // Users
  userExists(userId: string): Promise<boolean>;
  hasOpenUserReport(reporterId: string, targetUserId: string): Promise<boolean>;
  createUserReport(report: UserReportRecord): Promise<UserReportRecord>;

  // Messages
  getMessageRoomId(messageId: number): Promise<string | null>;
  isRoomMember(roomId: string, userId: string): Promise<boolean>;
  hasOpenMessageReport(reporterId: string, targetMessageId: number): Promise<boolean>;
  createMessageReport(report: MessageReportRecord): Promise<MessageReportRecord>;

  // Listado general con filtro opcional por targetType y status
  listReports(input?: {
    targetType?: ReportTargetType;
    status?: ReportStatus;
  }): Promise<AnyReportRecord[]>;
  findReportById(id: string): Promise<AnyReportRecord | null>;
  resolveReport(input: {
    id: string;
    status: Extract<ReportStatus, "resolved" | "dismissed">;
    at: Date;
  }): Promise<AnyReportRecord>;

  // Listings review queue (sin cambios)
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
