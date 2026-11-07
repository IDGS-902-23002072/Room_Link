import { randomUUID } from "node:crypto";
import {
  ActivityLogEntry,
  Agreement,
  AgreementAcceptance,
  Application,
  type ApplicationStatus,
  CompatibilityProfile,
  Connection,
  type ConnectionDirection,
  DailyMetrics,
  Notification,
  type NotificationType,
  Profile,
  RoomListing,
  Sanction,
  User,
  toUtcMidnight,
  type IActivityLogRepository,
  type IAgreementRepository,
  type IAnalyticsRepository,
  type IAnalyticsSource,
  type IApplicationRepository,
  type ICompatibilityRepository,
  type IConnectionRepository,
  type INotificationRepository,
  type IProfileRepository,
  type IRoomListingRepository,
  type ISanctionRepository,
  type IUserRepository,
  type ListNotificationsFilter,
  type NotificationPreference,
  type RoomPhotoInput,
  type RoomPhotoRecord,
  type CompatibilityFeedCandidate,
  type ConnectionRequest,
  type ActivityLogFilter,
} from "../../src/domain/index.js";
import type {
  AnyReportRecord,
  ListingReportRecord,
  ListingReviewRecord,
  ListingReviewStatus,
  MessageReportRecord,
  ModerationRepository,
  ReportStatus,
  ReportTargetType,
  UserReportRecord,
} from "../../src/modules/moderation/index.js";
import type {
  ChatContext,
  ChatInboxItem,
  ChatMessageRecord,
  ChatRoomRecord,
  MessagingRepository,
} from "../../src/modules/messaging/index.js";

export class InMemoryUserRepository implements IUserRepository {
  readonly users = new Map<string, User>();
  async findById(id: string) {
    return this.users.get(id) ?? null;
  }
  async findByEmail(email: string) {
    return [...this.users.values()].find((u) => u.email === email) ?? null;
  }
  async create(user: User) {
    this.users.set(user.id, user);
    return user;
  }
  async update(user: User) {
    this.users.set(user.id, user);
  }
  async delete(id: string) {
    this.users.delete(id);
  }
}

export class InMemoryProfileRepository implements IProfileRepository {
  readonly profiles = new Map<string, Profile>();
  async findByUserId(userId: string) {
    return this.profiles.get(userId) ?? null;
  }
  async create(profile: Profile) {
    this.profiles.set(profile.userId, profile);
    return profile;
  }
  async update(profile: Profile) {
    this.profiles.set(profile.userId, profile);
  }
}

export class InMemoryRoomRepository implements IRoomListingRepository {
  readonly rooms = new Map<string, RoomListing>();
  readonly photos = new Map<string, RoomPhotoRecord[]>();

  async findById(id: string) {
    return this.rooms.get(id) ?? null;
  }
  async findPublished(limit = 20, offset = 0) {
    return [...this.rooms.values()]
      .filter((r) => r.status === "published")
      .slice(offset, offset + limit);
  }
  async findByHostId(hostId: string) {
    return [...this.rooms.values()].filter((r) => r.hostId === hostId);
  }
  async create(room: RoomListing) {
    this.rooms.set(room.id, room);
    return room;
  }
  async createWithLocationAndPhotos(
    room: RoomListing,
    _location: { address: string; latitude: number; longitude: number },
    photos: RoomPhotoInput[],
  ) {
    room.setPhotoCount(photos.length);
    this.rooms.set(room.id, room);
    this.photos.set(
      room.id,
      photos.map((p, index) => ({
        id: randomUUID(),
        listingId: room.id,
        position: index + 1,
        ...p,
      })),
    );
    return room;
  }
  async update(room: RoomListing) {
    this.rooms.set(room.id, room);
  }
  async countPhotos(listingId: string) {
    return this.photos.get(listingId)?.length ?? 0;
  }
  async findPhotoById(listingId: string, photoId: string) {
    return this.photos.get(listingId)?.find((p) => p.id === photoId) ?? null;
  }
  async findFirstPhotoByListingId(listingId: string) {
    return this.photos.get(listingId)?.[0] ?? null;
  }
}

export class InMemoryApplicationRepository implements IApplicationRepository {
  readonly items = new Map<string, Application>();
  async findById(id: string) {
    return this.items.get(id) ?? null;
  }
  async findByListingId(listingId: string) {
    return [...this.items.values()].filter((a) => a.listingId === listingId);
  }
  async findByApplicantId(applicantId: string) {
    return [...this.items.values()].filter((a) => a.applicantId === applicantId);
  }
  async create(app: Application) {
    this.items.set(app.id, app);
    return app;
  }
  async update(app: Application) {
    this.items.set(app.id, app);
  }
}

export class InMemoryCompatibilityRepository implements ICompatibilityRepository {
  readonly activeUsers = new Set<string>();
  readonly profiles = new Map<string, CompatibilityProfile>();
  readonly connections: ConnectionRequest[] = [];
  feed: CompatibilityFeedCandidate[] = [];

  async isActiveUser(userId: string) {
    return this.activeUsers.has(userId);
  }
  async findByUserId(userId: string) {
    return this.profiles.get(userId) ?? null;
  }
  async save(profile: CompatibilityProfile) {
    this.profiles.set(profile.userId, profile);
  }
  async findFeed(_userId: string, pageSize: number, offset: number) {
    return this.feed.slice(offset, offset + pageSize);
  }
  async findCandidate(_viewerId: string, candidateId: string) {
    return this.feed.find((c) => c.userId === candidateId) ?? null;
  }
  async createConnection(
    requesterId: string,
    addresseeId: string,
    _intro: string | null,
  ): Promise<ConnectionRequest> {
    const req = {
      id: randomUUID(),
      requesterId,
      addresseeId,
      status: "pending" as const,
      createdAt: new Date(),
    };
    this.connections.push(req);
    return req;
  }
}

export class InMemoryConnectionRepository implements IConnectionRepository {
  readonly items = new Map<string, Connection>();
  async findById(id: string) {
    return this.items.get(id) ?? null;
  }
  async listForUser(userId: string, direction: ConnectionDirection) {
    return [...this.items.values()].filter((c) => {
      if (direction === "incoming") return c.addresseeId === userId;
      if (direction === "outgoing") return c.requesterId === userId;
      return c.addresseeId === userId || c.requesterId === userId;
    });
  }
  async update(connection: Connection) {
    this.items.set(connection.id, connection);
  }
}

export class InMemoryMessagingRepository implements MessagingRepository {
  private readonly rooms = new Map<string, ChatRoomRecord>();
  private readonly messages: ChatMessageRecord[] = [];
  private seq = 1;

  async openAuthorizedRoom(input: {
    userId: string;
    connectionId?: string;
    applicationId?: string;
  }): Promise<ChatRoomRecord> {
    const existing = [...this.rooms.values()].find(
      (r) =>
        (input.connectionId && r.connectionId === input.connectionId) ||
        (input.applicationId && r.applicationId === input.applicationId),
    );
    if (existing) return existing;
    const room: ChatRoomRecord = {
      id: randomUUID(),
      connectionId: input.connectionId ?? null,
      applicationId: input.applicationId ?? null,
      memberIds: [input.userId],
      createdAt: new Date(),
    };
    this.rooms.set(room.id, room);
    return room;
  }

  async isMember(roomId: string, userId: string) {
    return this.rooms.get(roomId)?.memberIds.includes(userId) ?? false;
  }

  registerMember(roomId: string, userId: string): void {
    const room = this.rooms.get(roomId);
    if (room && !room.memberIds.includes(userId)) room.memberIds.push(userId);
  }

  async listInbox(userId: string): Promise<ChatInboxItem[]> {
    return [...this.rooms.values()]
      .filter((r) => r.memberIds.includes(userId))
      .map((room) => {
        const forRoom = this.messages.filter((m) => m.roomId === room.id);
        const lastMessage = forRoom[forRoom.length - 1] ?? null;
        const counterpartId = room.memberIds.find((id) => id !== userId) ?? null;
        const unreadCount = forRoom.filter(
          (m) => m.senderId !== userId && !m.readAt,
        ).length;
        return { room, counterpartId, lastMessage, unreadCount };
      });
  }

  async listMessages(input: {
    roomId: string;
    userId: string;
    limit: number;
    beforeId?: number;
  }) {
    return this.messages
      .filter((m) => m.roomId === input.roomId)
      .filter((m) => (input.beforeId ? m.id < input.beforeId : true))
      .slice(-input.limit);
  }

  async createMessage(input: {
    roomId: string;
    senderId: string;
    body: string;
    sentAt: Date;
  }): Promise<ChatMessageRecord> {
    const message: ChatMessageRecord = {
      id: this.seq++,
      roomId: input.roomId,
      senderId: input.senderId,
      body: input.body,
      sentAt: input.sentAt,
      deliveredAt: null,
      readAt: null,
    };
    this.messages.push(message);
    return message;
  }

  async markDelivered(roomId: string, recipientId: string, at: Date) {
    let count = 0;
    for (const m of this.messages) {
      if (m.roomId === roomId && m.senderId !== recipientId && !m.deliveredAt) {
        m.deliveredAt = at;
        count++;
      }
    }
    return count;
  }

  async markRead(roomId: string, readerId: string, at: Date) {
    let count = 0;
    for (const m of this.messages) {
      if (m.roomId === roomId && m.senderId !== readerId && !m.readAt) {
        m.readAt = at;
        count++;
      }
    }
    return count;
  }

  async getContext(roomId: string, userId: string): Promise<ChatContext> {
    const room = this.rooms.get(roomId);
    return {
      roomId,
      counterpartId: room?.memberIds.find((id) => id !== userId) ?? null,
      connectionId: room?.connectionId ?? null,
      applicationId: room?.applicationId ?? null,
      listingId: null,
    };
  }
}

export class InMemoryModerationRepository implements ModerationRepository {
  readonly owners = new Map<string, string>();
  readonly users = new Set<string>();
  readonly roomMembers = new Map<string, Set<string>>();
  readonly messagesByRoom = new Map<number, string>();
  readonly listingReports: ListingReportRecord[] = [];
  readonly userReports: UserReportRecord[] = [];
  readonly messageReports: MessageReportRecord[] = [];
  readonly reviews = new Map<string, ListingReviewRecord>();

  async listingExists(listingId: string) {
    return this.owners.has(listingId);
  }
  async findListingOwnerId(listingId: string) {
    return this.owners.get(listingId) ?? null;
  }
  async hasOpenListingReport(reporterId: string, listingId: string) {
    return this.listingReports.some(
      (r) => r.reporterId === reporterId && r.listingId === listingId && r.status === "open",
    );
  }
  async createListingReport(r: ListingReportRecord) {
    this.listingReports.push(r);
    return r;
  }
  async listListingReports(status?: ReportStatus) {
    return this.listingReports.filter((r) => !status || r.status === status);
  }
  async userExists(userId: string) {
    return this.users.has(userId);
  }
  async hasOpenUserReport(reporterId: string, targetUserId: string) {
    return this.userReports.some(
      (r) =>
        r.reporterId === reporterId &&
        r.targetUserId === targetUserId &&
        r.status === "open",
    );
  }
  async createUserReport(r: UserReportRecord) {
    this.userReports.push(r);
    return r;
  }
  async getMessageRoomId(messageId: number) {
    return this.messagesByRoom.get(messageId) ?? null;
  }
  async isRoomMember(roomId: string, userId: string) {
    return this.roomMembers.get(roomId)?.has(userId) ?? false;
  }
  async hasOpenMessageReport(reporterId: string, targetMessageId: number) {
    return this.messageReports.some(
      (r) =>
        r.reporterId === reporterId &&
        r.targetMessageId === targetMessageId &&
        r.status === "open",
    );
  }
  async createMessageReport(r: MessageReportRecord) {
    this.messageReports.push(r);
    return r;
  }
  async listReports(input: {
    targetType?: ReportTargetType;
    status?: ReportStatus;
  } = {}): Promise<AnyReportRecord[]> {
    const all: AnyReportRecord[] = [
      ...this.listingReports.map<AnyReportRecord>((r) => ({
        id: r.id,
        reporterId: r.reporterId,
        targetType: "listing",
        targetListingId: r.listingId,
        targetUserId: null,
        targetMessageId: null,
        reason: r.reason,
        description: r.description ?? null,
        status: r.status,
        createdAt: r.createdAt,
        resolvedAt: r.resolvedAt ?? null,
      })),
      ...this.userReports.map<AnyReportRecord>((r) => ({
        id: r.id,
        reporterId: r.reporterId,
        targetType: "user",
        targetListingId: null,
        targetUserId: r.targetUserId,
        targetMessageId: null,
        reason: r.reason,
        description: r.description ?? null,
        status: r.status,
        createdAt: r.createdAt,
        resolvedAt: r.resolvedAt ?? null,
      })),
      ...this.messageReports.map<AnyReportRecord>((r) => ({
        id: r.id,
        reporterId: r.reporterId,
        targetType: "message",
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
  async findReportById(id: string) {
    const all = await this.listReports();
    return all.find((r) => r.id === id) ?? null;
  }
  async resolveReport(input: { id: string; status: "resolved" | "dismissed"; at: Date }) {
    for (const bucket of [
      this.listingReports,
      this.userReports,
      this.messageReports,
    ] as Array<Array<{ id: string; status: ReportStatus; resolvedAt?: Date | null }>>) {
      const found = bucket.find((r) => r.id === input.id);
      if (found) {
        found.status = input.status;
        found.resolvedAt = input.at;
      }
    }
    const result = await this.findReportById(input.id);
    if (!result) throw new Error("missing");
    return result;
  }
  async enqueueListing(listingId: string, at: Date) {
    const existing = this.reviews.get(listingId);
    if (existing) return existing;
    const r: ListingReviewRecord = { listingId, status: "pending", createdAt: at };
    this.reviews.set(listingId, r);
    return r;
  }
  async listReviews(status?: ListingReviewStatus) {
    return [...this.reviews.values()].filter((r) => !status || r.status === status);
  }
  async decideListing(input: {
    listingId: string;
    reviewerId: string;
    status: Exclude<ListingReviewStatus, "pending">;
    reason?: string;
    at: Date;
  }) {
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

export class InMemorySanctionRepository implements ISanctionRepository {
  readonly items = new Map<string, Sanction>();
  async findById(id: string) {
    return this.items.get(id) ?? null;
  }
  async listForUser(userId: string) {
    return [...this.items.values()].filter((s) => s.userId === userId);
  }
  async listActiveForUser(userId: string, at: Date) {
    return (await this.listForUser(userId)).filter((s) => s.isActive(at));
  }
  async listForListing(listingId: string) {
    return [...this.items.values()].filter((s) => s.listingId === listingId);
  }
  async create(s: Sanction) {
    this.items.set(s.id, s);
    return s;
  }
  async revoke(id: string, at: Date) {
    const s = this.items.get(id);
    if (s) s.expiresAt = at;
  }
}

export class InMemoryNotificationRepository implements INotificationRepository {
  readonly items = new Map<string, Notification>();
  readonly preferences = new Map<string, NotificationPreference>();
  async list(userId: string, filter: ListNotificationsFilter = {}) {
    const all = [...this.items.values()]
      .filter((n) => n.userId === userId)
      .filter((n) => (filter.unreadOnly ? n.readAt === null : true))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 25;
    return all.slice(offset, offset + limit);
  }
  async countUnread(userId: string) {
    return [...this.items.values()].filter(
      (n) => n.userId === userId && n.readAt === null,
    ).length;
  }
  async findById(id: string) {
    return this.items.get(id) ?? null;
  }
  async create(n: Notification) {
    this.items.set(n.id, n);
    return n;
  }
  async markRead(id: string, at: Date) {
    const n = this.items.get(id);
    if (n) n.markRead(at);
  }
  async markAllRead(userId: string, at: Date) {
    let count = 0;
    for (const n of this.items.values()) {
      if (n.userId === userId && n.isUnread()) {
        n.markRead(at);
        count++;
      }
    }
    return count;
  }
  async getPreferences(userId: string) {
    return [...this.preferences.values()].filter((p) => p.userId === userId);
  }
  async getPreferenceFor(userId: string, type: NotificationType) {
    return this.preferences.get(`${userId}:${type}`) ?? null;
  }
  async upsertPreference(p: NotificationPreference) {
    this.preferences.set(`${p.userId}:${p.type}`, p);
    return p;
  }
}

export class InMemoryAgreementRepository implements IAgreementRepository {
  readonly agreements = new Map<string, Agreement>();
  readonly acceptances: AgreementAcceptance[] = [];
  async findById(id: string) {
    return this.agreements.get(id) ?? null;
  }
  async listByListingId(listingId: string) {
    return [...this.agreements.values()].filter((a) => a.listingId === listingId);
  }
  async create(a: Agreement) {
    this.agreements.set(a.id, a);
    return a;
  }
  async findAcceptance(agreementId: string, userId: string) {
    return (
      this.acceptances.find(
        (a) => a.agreementId === agreementId && a.userId === userId,
      ) ?? null
    );
  }
  async listAcceptances(agreementId: string) {
    return this.acceptances.filter((a) => a.agreementId === agreementId);
  }
  async upsertAcceptance(a: AgreementAcceptance) {
    const idx = this.acceptances.findIndex(
      (x) => x.agreementId === a.agreementId && x.userId === a.userId,
    );
    if (idx >= 0) this.acceptances[idx] = a;
    else this.acceptances.push(a);
    return a;
  }
}

export class InMemoryActivityLogRepository implements IActivityLogRepository {
  readonly entries: ActivityLogEntry[] = [];
  async create(e: ActivityLogEntry) {
    this.entries.push(e);
    return e;
  }
  async list(filter: ActivityLogFilter = {}) {
    return this.entries
      .filter((e) => !filter.userId || e.userId === filter.userId)
      .filter((e) => !filter.action || e.action === filter.action)
      .slice(filter.offset ?? 0, (filter.offset ?? 0) + (filter.limit ?? 50));
  }
  async count(filter: ActivityLogFilter = {}) {
    return (await this.list({ ...filter, limit: Number.MAX_SAFE_INTEGER, offset: 0 })).length;
  }
}

export class InMemoryAnalyticsRepository implements IAnalyticsRepository {
  readonly items = new Map<string, DailyMetrics>();
  async upsertDaily(m: DailyMetrics) {
    this.items.set(m.metricDate.toISOString().slice(0, 10), m);
    return m;
  }
  async findByDate(d: Date) {
    return this.items.get(toUtcMidnight(d).toISOString().slice(0, 10)) ?? null;
  }
  async listRange(from: Date, to: Date) {
    const f = toUtcMidnight(from).toISOString().slice(0, 10);
    const t = toUtcMidnight(to).toISOString().slice(0, 10);
    return [...this.items.entries()]
      .filter(([k]) => k >= f && k <= t)
      .map(([, v]) => v);
  }
}

export class ZeroAnalyticsSource implements IAnalyticsSource {
  async countUsersRegisteredOn() {
    return 0;
  }
  async countActiveListingsAt() {
    return 0;
  }
  async countConnectionsSentOn() {
    return 0;
  }
  async countConnectionsAcceptedOn() {
    return 0;
  }
  async countListingsClosedOn() {
    return 0;
  }
  async avgDaysToCloseOn() {
    return null;
  }
  async avgAffinityScoreOn() {
    return null;
  }
}

/** Factory para construir el usuario admin con hash compatible con auth-fakes. */
export function buildUser(input: {
  id: string;
  email: string;
  roles: Array<"admin" | "seeker" | "host">;
  passwordPlain?: string;
}): User {
  const now = new Date("2026-11-07T00:00:00.000Z");
  return new User({
    id: input.id,
    email: input.email,
    passwordHash: `hash:${input.passwordPlain ?? "password"}`,
    status: "active",
    roles: input.roles,
    termsAcceptedAt: now,
    createdAt: now,
    updatedAt: now,
  });
}

// Alias de utilidad por si hace falta en otros sitios.
export type ApplicationStatusType = ApplicationStatus;
