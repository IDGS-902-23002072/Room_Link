import { and, count, desc, eq, isNull, lt, ne, or } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { randomUUID } from "node:crypto";
import { roomListings } from "../../db/schema/rooms.js";
import {
  appApplications,
  chatMessages,
  chatRoomMembers,
  chatRooms,
  connConnections,
  type ChatMessageRow,
  type ChatRoomRow,
  type NewChatMessage,
} from "../../db/schema/social.js";
import type {
  ChatContext,
  ChatInboxItem,
  ChatMessageRecord,
  ChatRoomRecord,
  MessagingRepository,
} from "../../modules/messaging/index.js";
import { AppError } from "../../shared/AppError.js";

export class DrizzleMessagingRepository implements MessagingRepository {
  constructor(private readonly db: MySql2Database<any>) {}

  async openAuthorizedRoom(input: {
    userId: string;
    connectionId?: string;
    applicationId?: string;
  }): Promise<ChatRoomRecord> {
    const existing = await this.findByOrigin(input.connectionId, input.applicationId);
    if (existing) {
      const room = await this.toRoom(existing);
      if (!room.memberIds.includes(input.userId)) {
        throw new AppError("No puedes abrir este chat.", 403, "CHAT_ACCESS_DENIED");
      }
      return room;
    }

    let members: string[];
    if (input.connectionId) {
      const rows = await this.db
        .select()
        .from(connConnections)
        .where(
          and(
            eq(connConnections.id, input.connectionId),
            eq(connConnections.status, "accepted"),
            or(
              eq(connConnections.requesterId, input.userId),
              eq(connConnections.addresseeId, input.userId),
            ),
          ),
        )
        .limit(1);
      const connection = rows[0];
      if (!connection) {
        throw new AppError(
          "La conexión no existe, no está aceptada o no te pertenece.",
          403,
          "CHAT_ORIGIN_NOT_AUTHORIZED",
        );
      }
      members = [connection.requesterId, connection.addresseeId];
    } else {
      const rows = await this.db
        .select({
          applicantId: appApplications.applicantId,
          hostId: roomListings.hostId,
        })
        .from(appApplications)
        .innerJoin(roomListings, eq(roomListings.id, appApplications.listingId))
        .where(
          and(
            eq(appApplications.id, input.applicationId!),
            eq(appApplications.status, "accepted"),
            or(eq(appApplications.applicantId, input.userId), eq(roomListings.hostId, input.userId)),
          ),
        )
        .limit(1);
      const application = rows[0];
      if (!application) {
        throw new AppError(
          "La postulación no existe, no está aceptada o no te pertenece.",
          403,
          "CHAT_ORIGIN_NOT_AUTHORIZED",
        );
      }
      members = [application.applicantId, application.hostId];
    }

    const id = randomUUID();
    const createdAt = new Date();
    await this.db.transaction(async (transaction) => {
      await transaction.insert(chatRooms).values({
        id,
        connectionId: input.connectionId ?? null,
        applicationId: input.applicationId ?? null,
        createdAt,
      });
      await transaction.insert(chatRoomMembers).values(
        members.map((userId) => ({ roomId: id, userId })),
      );
    });
    return {
      id,
      connectionId: input.connectionId ?? null,
      applicationId: input.applicationId ?? null,
      memberIds: members,
      createdAt,
    };
  }

  async isMember(roomId: string, userId: string): Promise<boolean> {
    const rows = await this.db
      .select({ roomId: chatRoomMembers.roomId })
      .from(chatRoomMembers)
      .where(and(eq(chatRoomMembers.roomId, roomId), eq(chatRoomMembers.userId, userId)))
      .limit(1);
    return Boolean(rows[0]);
  }

  async listInbox(userId: string): Promise<ChatInboxItem[]> {
    const rows: ChatRoomRow[] = await this.db
      .select({
        id: chatRooms.id,
        connectionId: chatRooms.connectionId,
        applicationId: chatRooms.applicationId,
        createdAt: chatRooms.createdAt,
      })
      .from(chatRooms)
      .innerJoin(chatRoomMembers, eq(chatRoomMembers.roomId, chatRooms.id))
      .where(eq(chatRoomMembers.userId, userId))
      .orderBy(desc(chatRooms.createdAt));

    const inbox: ChatInboxItem[] = [];
    for (const row of rows) {
      const room = await this.toRoom(row);
      const messages: ChatMessageRow[] = await this.db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.roomId, row.id))
        .orderBy(desc(chatMessages.id))
        .limit(1);
      const unread = await this.db
        .select({ total: count() })
        .from(chatMessages)
        .where(
          and(
            eq(chatMessages.roomId, row.id),
            ne(chatMessages.senderId, userId),
            isNull(chatMessages.readAt),
          ),
        );
      inbox.push({
        room,
        counterpartId: room.memberIds.find((id) => id !== userId) ?? null,
        lastMessage: messages[0] ? this.toMessage(messages[0]) : null,
        unreadCount: Number(unread[0]?.total ?? 0),
      });
    }
    return inbox;
  }

  async listMessages(input: {
    roomId: string;
    userId: string;
    limit: number;
    beforeId?: number;
  }): Promise<ChatMessageRecord[]> {
    const condition = input.beforeId
      ? and(eq(chatMessages.roomId, input.roomId), lt(chatMessages.id, input.beforeId))
      : eq(chatMessages.roomId, input.roomId);
    const rows: ChatMessageRow[] = await this.db
      .select()
      .from(chatMessages)
      .where(condition)
      .orderBy(desc(chatMessages.id))
      .limit(input.limit);
    return rows.reverse().map((row) => this.toMessage(row));
  }

  async createMessage(input: {
    roomId: string;
    senderId: string;
    body: string;
    sentAt: Date;
  }): Promise<ChatMessageRecord> {
    const record: NewChatMessage = input;
    const ids = await this.db.insert(chatMessages).values(record).$returningId();
    const id = Number(ids[0]?.id);
    return { id, ...input, deliveredAt: null, readAt: null };
  }

  async markDelivered(roomId: string, recipientId: string, at: Date): Promise<number> {
    const [result] = await this.db
      .update(chatMessages)
      .set({ deliveredAt: at })
      .where(
        and(
          eq(chatMessages.roomId, roomId),
          ne(chatMessages.senderId, recipientId),
          isNull(chatMessages.deliveredAt),
        ),
      );
    return Number(result.affectedRows ?? 0);
  }

  async markRead(roomId: string, readerId: string, at: Date): Promise<number> {
    const [result] = await this.db
      .update(chatMessages)
      .set({ deliveredAt: at, readAt: at })
      .where(
        and(
          eq(chatMessages.roomId, roomId),
          ne(chatMessages.senderId, readerId),
          isNull(chatMessages.readAt),
        ),
      );
    await this.db
      .update(chatRoomMembers)
      .set({ lastReadAt: at })
      .where(and(eq(chatRoomMembers.roomId, roomId), eq(chatRoomMembers.userId, readerId)));
    return Number(result.affectedRows ?? 0);
  }

  async getContext(roomId: string, userId: string): Promise<ChatContext> {
    const rows: ChatRoomRow[] = await this.db
      .select()
      .from(chatRooms)
      .where(eq(chatRooms.id, roomId))
      .limit(1);
    const row = rows[0];
    if (!row) throw new AppError("Conversación no encontrada.", 404, "CHAT_NOT_FOUND");
    const room = await this.toRoom(row);
    let listingId: string | null = null;
    if (row.applicationId) {
      const applications = await this.db
        .select({ listingId: appApplications.listingId })
        .from(appApplications)
        .where(eq(appApplications.id, row.applicationId))
        .limit(1);
      listingId = applications[0]?.listingId ?? null;
    }
    return {
      roomId,
      counterpartId: room.memberIds.find((id) => id !== userId) ?? null,
      connectionId: row.connectionId,
      applicationId: row.applicationId,
      listingId,
    };
  }

  private async findByOrigin(
    connectionId?: string,
    applicationId?: string,
  ): Promise<ChatRoomRow | null> {
    const condition = connectionId
      ? eq(chatRooms.connectionId, connectionId)
      : eq(chatRooms.applicationId, applicationId!);
    const rows: ChatRoomRow[] = await this.db.select().from(chatRooms).where(condition).limit(1);
    return rows[0] ?? null;
  }

  private async toRoom(row: ChatRoomRow): Promise<ChatRoomRecord> {
    const members = await this.db
      .select({ userId: chatRoomMembers.userId })
      .from(chatRoomMembers)
      .where(eq(chatRoomMembers.roomId, row.id));
    return {
      id: row.id,
      connectionId: row.connectionId,
      applicationId: row.applicationId,
      memberIds: members.map((member) => member.userId),
      createdAt: new Date(row.createdAt),
    };
  }

  private toMessage(row: ChatMessageRow): ChatMessageRecord {
    return {
      id: row.id,
      roomId: row.roomId,
      senderId: row.senderId,
      body: row.body,
      sentAt: new Date(row.sentAt),
      deliveredAt: row.deliveredAt ? new Date(row.deliveredAt) : null,
      readAt: row.readAt ? new Date(row.readAt) : null,
    };
  }
}
