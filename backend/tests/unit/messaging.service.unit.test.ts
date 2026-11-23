import { describe, expect, it } from "vitest";
import { AppError } from "../../src/shared/AppError.js";
import {
  InMemoryMessageEventPublisher,
  MessagingService,
  type ChatContext,
  type ChatInboxItem,
  type ChatMessageRecord,
  type ChatRoomRecord,
  type MessagingRepository,
} from "../../src/modules/messaging/index.js";

class InMemoryMessagingRepository implements MessagingRepository {
  readonly rooms = new Map<string, ChatRoomRecord>();
  readonly messages: ChatMessageRecord[] = [];
  readonly acceptedConnections = new Map<string, string[]>([["accepted-1", ["u-1", "u-2"]]]);
  private nextMessageId = 1;

  async openAuthorizedRoom(input: {
    userId: string;
    connectionId?: string;
    applicationId?: string;
  }): Promise<ChatRoomRecord> {
    const members = input.connectionId ? this.acceptedConnections.get(input.connectionId) : undefined;
    if (!members?.includes(input.userId)) {
      throw new AppError("Origen no autorizado", 403, "CHAT_ORIGIN_NOT_AUTHORIZED");
    }
    const room: ChatRoomRecord = {
      id: "room-1",
      connectionId: input.connectionId,
      applicationId: input.applicationId,
      memberIds: members,
      createdAt: new Date("2026-11-05T12:00:00Z"),
    };
    this.rooms.set(room.id, room);
    return room;
  }

  async isMember(roomId: string, userId: string): Promise<boolean> {
    return this.rooms.get(roomId)?.memberIds.includes(userId) ?? false;
  }

  async listInbox(userId: string): Promise<ChatInboxItem[]> {
    return [...this.rooms.values()]
      .filter((room) => room.memberIds.includes(userId))
      .map((room) => {
        const roomMessages = this.messages.filter((message) => message.roomId === room.id);
        return {
          room,
          counterpartId: room.memberIds.find((id) => id !== userId) ?? null,
          lastMessage: roomMessages.at(-1) ?? null,
          unreadCount: roomMessages.filter(
            (message) => message.senderId !== userId && !message.readAt,
          ).length,
        };
      });
  }

  async listMessages(input: {
    roomId: string;
    userId: string;
    limit: number;
    beforeId?: number;
  }): Promise<ChatMessageRecord[]> {
    return this.messages
      .filter(
        (message) =>
          message.roomId === input.roomId &&
          (input.beforeId === undefined || message.id < input.beforeId),
      )
      .sort((left, right) => left.id - right.id)
      .slice(-input.limit);
  }

  async createMessage(input: {
    roomId: string;
    senderId: string;
    body: string;
    sentAt: Date;
  }): Promise<ChatMessageRecord> {
    const message: ChatMessageRecord = {
      id: this.nextMessageId++,
      ...input,
      deliveredAt: null,
      readAt: null,
    };
    this.messages.push(message);
    return message;
  }

  async markDelivered(roomId: string, recipientId: string, at: Date): Promise<number> {
    let updated = 0;
    for (const message of this.messages) {
      if (message.roomId === roomId && message.senderId !== recipientId && !message.deliveredAt) {
        message.deliveredAt = at;
        updated += 1;
      }
    }
    return updated;
  }

  async markRead(roomId: string, readerId: string, at: Date): Promise<number> {
    let updated = 0;
    for (const message of this.messages) {
      if (message.roomId === roomId && message.senderId !== readerId && !message.readAt) {
        message.deliveredAt = at;
        message.readAt = at;
        updated += 1;
      }
    }
    return updated;
  }

  async getContext(roomId: string, userId: string): Promise<ChatContext> {
    const room = this.rooms.get(roomId)!;
    return {
      roomId,
      counterpartId: room.memberIds.find((id) => id !== userId) ?? null,
      connectionId: room.connectionId,
      applicationId: room.applicationId,
      listingId: null,
    };
  }
}

describe("MessagingService", () => {
  it("opens a room only from exactly one accepted origin", async () => {
    const repository = new InMemoryMessagingRepository();
    const service = new MessagingService(repository, new InMemoryMessageEventPublisher());

    await expect(service.openRoom({ userId: "u-1" })).rejects.toMatchObject({
      code: "CHAT_ORIGIN_REQUIRED",
    });
    await expect(
      service.openRoom({ userId: "u-1", connectionId: "accepted-1", applicationId: "app-1" }),
    ).rejects.toMatchObject({ code: "CHAT_ORIGIN_REQUIRED" });
    await expect(
      service.openRoom({ userId: "u-3", connectionId: "accepted-1" }),
    ).rejects.toMatchObject({ code: "CHAT_ORIGIN_NOT_AUTHORIZED" });

    await expect(
      service.openRoom({ userId: "u-1", connectionId: "accepted-1" }),
    ).resolves.toMatchObject({ memberIds: ["u-1", "u-2"] });
  });

  it("rejects non-members and invalid message bodies", async () => {
    const repository = new InMemoryMessagingRepository();
    const service = new MessagingService(repository, new InMemoryMessageEventPublisher());
    await service.openRoom({ userId: "u-1", connectionId: "accepted-1" });

    await expect(service.sendMessage("room-1", "u-3", "hola")).rejects.toMatchObject({
      code: "CHAT_ACCESS_DENIED",
    });
    await expect(service.sendMessage("room-1", "u-1", "   ")).rejects.toMatchObject({
      code: "INVALID_MESSAGE_BODY",
    });
    expect(repository.messages).toHaveLength(0);
  });

  it("persists messages in stable chronological order and publishes creation events", async () => {
    const repository = new InMemoryMessagingRepository();
    const events = new InMemoryMessageEventPublisher();
    const published: string[] = [];
    events.subscribe("room-1", (event) => published.push(event.type));
    let now = new Date("2026-11-05T12:00:00Z");
    const service = new MessagingService(repository, events, () => new Date(now));
    await service.openRoom({ userId: "u-1", connectionId: "accepted-1" });

    await service.sendMessage("room-1", "u-1", " primero ");
    now = new Date("2026-11-05T12:00:01Z");
    await service.sendMessage("room-1", "u-2", "segundo");
    await Promise.resolve();

    const history = await service.listMessages("room-1", "u-1");
    expect(history.map((message) => [message.id, message.body])).toEqual([
      [1, "primero"],
      [2, "segundo"],
    ]);
    expect(published).toEqual(["message.created", "message.created"]);
  });

  it("marks only counterpart messages as delivered and read", async () => {
    const repository = new InMemoryMessagingRepository();
    const service = new MessagingService(repository, new InMemoryMessageEventPublisher());
    await service.openRoom({ userId: "u-1", connectionId: "accepted-1" });
    await service.sendMessage("room-1", "u-1", "para u2");
    await service.sendMessage("room-1", "u-2", "para u1");

    expect(await service.markDelivered("room-1", "u-2")).toBe(1);
    expect(repository.messages[0]?.deliveredAt).toBeInstanceOf(Date);
    expect(repository.messages[1]?.deliveredAt).toBeNull();
    expect(await service.markRead("room-1", "u-2")).toBe(1);
    expect(repository.messages[0]?.readAt).toBeInstanceOf(Date);
    expect(repository.messages[1]?.readAt).toBeNull();
  });
});
