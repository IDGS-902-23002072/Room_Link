import { randomUUID } from "node:crypto";
import {
  ActivityLogEntry,
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
  type RoomFeedFilters,
  type RoomFeedItem,
  type ISanctionRepository,
  type IUserRepository,
  type ListNotificationsFilter,
  type NotificationPreference,
  type RoomPhotoInput,
  type RoomPhotoRecord,
  type RoomLocationInput,
  type RoomPhotoMetadata,
  type RoomPhotoUpdateItem,
  type RoomRulesRecord,
  type RoomCostItemInput,
  type RoomCostItemRecord,
  type CompatibilityFeedCandidate,
  type ConnectionRequest,
  type ActivityLogFilter,
  type ISearchRepository,
  type SearchFilters,
  type Pagination,
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
  async grantHostRole(id: string): Promise<void> {
    this.users.get(id)?.grantHostRole();
  }
  async delete(id: string) {
    this.users.delete(id);
  }
}

// Perfil extendido (HU-02, Roberto): se reexporta el fake completo que implementa
// la interfaz IProfileRepository ampliada (fotos, socials, privacy, preferencias).
import { InMemoryExtendedProfileRepository } from "./in-memory-profile-repo.js";
export { InMemoryExtendedProfileRepository as InMemoryProfileRepository };


export class InMemoryRoomRepository implements IRoomListingRepository {
  readonly rooms = new Map<string, RoomListing>();
  readonly photos = new Map<string, RoomPhotoRecord[]>();
  readonly locations = new Map<string, RoomLocationInput>();
  readonly rules = new Map<string, RoomRulesRecord>();
  readonly costItems = new Map<string, RoomCostItemRecord[]>();

  async findRulesByListingId(listingId: string) {
    return this.rules.get(listingId) ?? null;
  }

  async upsertRules(listingId: string, rules: RoomRulesRecord) {
    this.rules.set(listingId, rules);
    return rules;
  }

  async findCostItemsByListingId(listingId: string) {
    return this.costItems.get(listingId) ?? [];
  }

  async replaceCostItems(listingId: string, items: RoomCostItemInput[]) {
    const created: RoomCostItemRecord[] = items.map((item) => ({
      ...item,
      id: randomUUID(),
      listingId,
    }));
    this.costItems.set(listingId, created);
    return created;
  }

  // ======================================================
  // CONSULTAR PUBLICACIONES
  // ======================================================

  async findById(id: string) {
    return this.rooms.get(id) ?? null;
  }

  async findPublishedFeed(
    filters: RoomFeedFilters,
    limit: number,
    offset: number,
  ): Promise<RoomFeedItem[]> {
    const term = filters.search?.toLocaleLowerCase("es");
    return Array.from(this.rooms.values())
      .filter((room) => room.status === "published")
      .filter((room) => filters.minRent === undefined || room.monthlyRent >= filters.minRent)
      .filter((room) => filters.maxRent === undefined || room.monthlyRent <= filters.maxRent)
      .filter((room) => !filters.excludeHostId || room.hostId !== filters.excludeHostId)
      .filter((room) => {
        if (!term) return true;
        const address = room.locationId ? this.locations.get(room.locationId)?.address : "";
        return `${room.title} ${room.description ?? ""} ${address ?? ""}`
          .toLocaleLowerCase("es")
          .includes(term);
      })
      .sort(
        (a, b) =>
          (b.publishedAt?.getTime() ?? b.createdAt.getTime()) -
          (a.publishedAt?.getTime() ?? a.createdAt.getTime()),
      )
      .slice(offset, offset + limit)
      .map((room) => ({
        id: room.id,
        hostId: room.hostId,
        hostName: null,
        title: room.title,
        description: room.description ?? null,
        monthlyRent: room.monthlyRent,
        availableFrom: room.availableFrom ?? null,
        maxRoommates: room.maxRoommates ?? null,
        photoCount: room.photoCount,
        address: room.locationId ? (this.locations.get(room.locationId)?.address ?? null) : null,
        zone: null,
        city: null,
        publishedAt: room.publishedAt ?? null,
      }));
  }

  async findPublished(limit = 20, offset = 0) {
    return [...this.rooms.values()]
      .filter((room) => room.status === "published")
      .slice(offset, offset + limit);
  }

  async findByHostId(hostId: string) {
    return [...this.rooms.values()].filter(
      (room) => room.hostId === hostId
    );
  }

  // ======================================================
  // CREAR PUBLICACIÓN
  // ======================================================

  // Crear una publicación básica.
  // Permite guardar borradores sin ubicación ni fotografías.
  async create(room: RoomListing) {
    room.setPhotoCount(this.photos.get(room.id)?.length ?? 0);

    this.rooms.set(room.id, room);

    return room;
  }


  async createWithLocationAndPhotos(
    room: RoomListing,
    location: RoomLocationInput | null,
    photos: RoomPhotoInput[]
  ): Promise<RoomListing> {
    if (photos.length > 10) {
      throw new Error("No se permiten más de 10 fotografías");
    }

    // Si hay ubicación, reutilizar su ID o generar uno nuevo.
    // Si no hay ubicación, guardar locationId como null.
    const locationId = location
      ? room.locationId ?? randomUUID()
      : null;

    const roomWithData = new RoomListing({
      id: room.id,
      hostId: room.hostId,
      locationId,
      title: room.title,
      description: room.description,
      monthlyRent: room.monthlyRent,
      availableFrom: room.availableFrom,
      maxRoommates: room.maxRoommates,
      status: room.status,
      photoCount: photos.length,
      publishedAt: room.publishedAt,
      closedAt: room.closedAt,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
    });

    this.rooms.set(room.id, roomWithData);

    // Guardar ubicación únicamente cuando exista.
    if (location && locationId) {
      this.locations.set(locationId, location);
    }

    // Guardar fotografías, incluso si la lista está vacía.
    this.photos.set(
      room.id,
      photos.map((photo, index) => ({
        id: randomUUID(),
        listingId: room.id,
        position: index + 1,
        ...photo,
      }))
    );

    return roomWithData;
  }


  // ======================================================
  // ACTUALIZAR PUBLICACIÓN
  // ======================================================

  async update(room: RoomListing) {
    this.rooms.set(room.id, room);
  }

  // ======================================================
  // FOTOGRAFÍAS
  // ======================================================

  async countPhotos(listingId: string) {
    return this.photos.get(listingId)?.length ?? 0;
  }

  async findPhotoById(listingId: string, photoId: string) {
    return (
      this.photos.get(listingId)?.find(
        (photo) => photo.id === photoId
      ) ?? null
    );
  }

  async findFirstPhotoByListingId(listingId: string) {
    return this.photos.get(listingId)?.[0] ?? null;
  }

  async findPhotosByListingId(
    listingId: string
  ): Promise<RoomPhotoMetadata[]> {
    const photos = this.photos.get(listingId) ?? [];

    return photos.map((photo) => ({
      id: photo.id,
      listingId: photo.listingId,
      fileName: photo.fileName,
      mimeType: photo.mimeType,
      position: photo.position,
    }));
  }

  // ======================================================
  // UBICACIÓN
  // ======================================================

  async findLocationById(
    id: string
  ): Promise<RoomLocationInput | null> {
    return this.locations.get(id) ?? null;
  }

  // ======================================================
  // ACTUALIZAR UBICACIÓN Y FOTOGRAFÍAS
  // ======================================================


  async updateWithLocationAndPhotos(
    room: RoomListing,
    location: RoomLocationInput | null,
    photos: RoomPhotoUpdateItem[]
  ): Promise<void> {
    if (photos.length > 10) {
      throw new Error("No se permiten más de 10 fotografías");
    }

    const currentPhotos = this.photos.get(room.id) ?? [];
    const updatedPhotos: RoomPhotoRecord[] = [];

    const existingIds = new Set<string>();

    // Preparar las fotografías respetando el orden recibido.
    for (const [index, item] of photos.entries()) {
      if (item.type === "existing") {
        if (existingIds.has(item.id)) {
          throw new Error(
            "No puedes agregar dos veces la misma fotografía."
          );
        }

        existingIds.add(item.id);

        const existingPhoto = currentPhotos.find(
          (photo) => photo.id === item.id
        );

        if (!existingPhoto) {
          throw new Error("Fotografía no encontrada");
        }

        updatedPhotos.push({
          ...existingPhoto,
          position: index + 1,
        });
      } else {
        updatedPhotos.push({
          id: randomUUID(),
          listingId: room.id,
          fileName: item.photo.fileName,
          mimeType: item.photo.mimeType,
          imageData: item.photo.imageData,
          position: index + 1,
        });
      }
    }

    // Si se proporciona ubicación, conservar su ID o generar uno.
    // Si llega null, la publicación queda sin ubicación.
    const previousLocationId = room.locationId;

    const locationId = location
      ? previousLocationId ?? randomUUID()
      : null;

    // Reconstruir la entidad con el locationId actualizado.
    const updatedRoom = new RoomListing({
      id: room.id,
      hostId: room.hostId,
      locationId,
      title: room.title,
      description: room.description,
      monthlyRent: room.monthlyRent,
      availableFrom: room.availableFrom,
      maxRoommates: room.maxRoommates,
      status: room.status,
      photoCount: updatedPhotos.length,
      publishedAt: room.publishedAt,
      closedAt: room.closedAt,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
    });

    // Guardar la ubicación si existe.
    if (location && locationId) {
      this.locations.set(locationId, location);
    }

    // Si se quitó la ubicación, eliminar su registro en memoria.
    if (!location && previousLocationId) {
      this.locations.delete(previousLocationId);
    }

    this.rooms.set(room.id, updatedRoom);
    this.photos.set(room.id, updatedPhotos);
  }

  // ======================================================
  // CAMBIAR ESTADO DE UNA PUBLICACIÓN
  // ======================================================

  async transitionStatus(
    id: string,
    expectedStatus: "draft" | "published" | "paused",
    newStatus: "published" | "paused" | "closed"
  ): Promise<boolean> {
    const room = this.rooms.get(id);

    if (!room || room.status !== expectedStatus) {
      return false;
    }

    // BORRADOR -> PUBLICADA
    if (
      expectedStatus === "draft" &&
      newStatus === "published"
    ) {
      room.setPhotoCount(this.photos.get(id)?.length ?? 0);
      room.publish();
    }

    // PUBLICADA -> PAUSADA
    else if (
      expectedStatus === "published" &&
      newStatus === "paused"
    ) {
      room.pause();
    }

    // PAUSADA -> PUBLICADA
    else if (
      expectedStatus === "paused" &&
      newStatus === "published"
    ) {
      room.setPhotoCount(this.photos.get(id)?.length ?? 0);
      room.reactivate();
    }

    // PUBLICADA -> CERRADA
    else if (
      expectedStatus === "published" &&
      newStatus === "closed"
    ) {
      room.close();
    }

    // Cualquier otra transición está prohibida.
    else {
      return false;
    }

    this.rooms.set(id, room);

    return true;
  }
}




export class InMemoryApplicationRepository implements IApplicationRepository {
  readonly items = new Map<string, Application>();
  async findById(id: string) {
    const app = this.items.get(id);
    if (!app) return null;
    const { createdAt, decidedAt } = app.toJSON();
    return new Application({
      id: app.id, listingId: app.listingId, applicantId: app.applicantId, status: app.status,
      message: app.message, compatibilityScore: app.compatibilityScore,
      createdAt: new Date(String(createdAt)), decidedAt: decidedAt ? new Date(String(decidedAt)) : null,
    });
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
  async update(app: Application, previousStatus: Application["status"]) {
    if (this.items.get(app.id)?.status !== previousStatus) return false;
    this.items.set(app.id, app);
    return true;
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

// Acuerdos (HU-12, Roberto): se reexporta el fake que implementa la interfaz
// IAgreementRepository de Roberto (getListingSnapshot, findByListing, findByUser…).
export { InMemoryAgreementRepository } from "./in-memory-agreement-repo.js";

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

export class InMemorySearchRepository implements ISearchRepository {
  constructor(
    private readonly profileRepo?: InMemoryExtendedProfileRepository,
    private readonly roomRepo?: InMemoryRoomRepository,
  ) {}

  async searchProfiles(
    _filters: SearchFilters,
    pagination: Pagination,
  ): Promise<{ items: Profile[]; total: number }> {
    const all = this.profileRepo ? [...this.profileRepo.profiles.values()] : [];
    const offset = (pagination.page - 1) * pagination.pageSize;
    return {
      items: all.slice(offset, offset + pagination.pageSize),
      total: all.length,
    };
  }

  async searchListings(
    filters: SearchFilters,
    pagination: Pagination,
  ): Promise<{ items: RoomListing[]; total: number }> {
    let all = this.roomRepo
      ? [...this.roomRepo.rooms.values()].filter((r) => r.status === "published")
      : [];
    if (filters.budgetMin != null) {
      all = all.filter((r) => r.monthlyRent >= filters.budgetMin!);
    }
    if (filters.budgetMax != null) {
      all = all.filter((r) => r.monthlyRent <= filters.budgetMax!);
    }
    const offset = (pagination.page - 1) * pagination.pageSize;
    return {
      items: all.slice(offset, offset + pagination.pageSize),
      total: all.length,
    };
  }

  async countProfiles(_filters: SearchFilters): Promise<number> {
    return this.profileRepo ? this.profileRepo.profiles.size : 0;
  }

  async countListings(filters: SearchFilters): Promise<number> {
    const { total } = await this.searchListings(filters, { page: 1, pageSize: 1000 });
    return total;
  }
}

