import { beforeEach, describe, expect, it } from "vitest";
import {
  Notification,
  type INotificationRepository,
  type ListNotificationsFilter,
  type NotificationPreference,
  type NotificationType,
} from "../../src/domain/index.js";
import {
  InProcessEventBus,
  NotificationsEventConsumer,
  NotificationsService,
} from "../../src/modules/notifications/index.js";
import type { DomainEventPublisher } from "../../src/modules/auth/index.js";

class InMemoryNotificationRepository implements INotificationRepository {
  readonly items = new Map<string, Notification>();
  readonly preferences = new Map<string, NotificationPreference>();

  async list(userId: string, filter: ListNotificationsFilter = {}) {
    const all = Array.from(this.items.values())
      .filter((n) => n.userId === userId)
      .filter((n) => (filter.unreadOnly ? n.readAt === null : true))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 25;
    return all.slice(offset, offset + limit);
  }
  async countUnread(userId: string) {
    return Array.from(this.items.values()).filter(
      (n) => n.userId === userId && n.readAt === null,
    ).length;
  }
  async findById(id: string) {
    return this.items.get(id) ?? null;
  }
  async create(notification: Notification) {
    this.items.set(notification.id, notification);
    return notification;
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
    return Array.from(this.preferences.values()).filter((p) => p.userId === userId);
  }
  async getPreferenceFor(userId: string, type: NotificationType) {
    return this.preferences.get(`${userId}:${type}`) ?? null;
  }
  async upsertPreference(preference: NotificationPreference) {
    this.preferences.set(`${preference.userId}:${preference.type}`, preference);
    return preference;
  }
}

function makeBus(): {
  bus: InProcessEventBus;
  outboxEvents: Array<{ type: string; aggregateId: string }>;
} {
  const outboxEvents: Array<{ type: string; aggregateId: string }> = [];
  const outbox: DomainEventPublisher = {
    publish: async (event) => {
      outboxEvents.push({ type: event.type, aggregateId: event.aggregateId });
    },
  };
  return { bus: new InProcessEventBus(outbox), outboxEvents };
}

describe("NotificationsService", () => {
  let repo: InMemoryNotificationRepository;
  let service: NotificationsService;
  const now = new Date("2026-11-07T10:00:00Z");

  beforeEach(() => {
    repo = new InMemoryNotificationRepository();
    service = new NotificationsService(repo, () => now);
  });

  it("creates a notification when there is no preference stored (default allowed)", async () => {
    const created = await service.createIfAllowed({
      userId: "u1",
      type: "system",
      title: "Hola",
    });
    expect(created).not.toBeNull();
    expect(repo.items.size).toBe(1);
  });

  it("skips creation when the user disabled in-app for that type", async () => {
    await service.updatePreference({
      userId: "u1",
      type: "new_message",
      inApp: false,
      email: true,
    });
    const created = await service.createIfAllowed({
      userId: "u1",
      type: "new_message",
      title: "Mensaje",
    });
    expect(created).toBeNull();
    expect(repo.items.size).toBe(0);
  });

  it("markRead rejects notifications owned by someone else", async () => {
    const created = await service.createIfAllowed({
      userId: "owner",
      type: "system",
      title: "x",
    });
    await expect(service.markRead(created!.id, "intruder")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("markAllRead marks only unread ones and returns the count", async () => {
    await service.createIfAllowed({ userId: "u1", type: "system", title: "1" });
    const second = await service.createIfAllowed({
      userId: "u1",
      type: "system",
      title: "2",
    });
    await service.markRead(second!.id, "u1");
    const updated = await service.markAllRead("u1");
    expect(updated).toBe(1);
    expect(await service.countUnread("u1")).toBe(0);
  });

  it("getPreferences fills gaps with default in-app+email", async () => {
    await service.updatePreference({
      userId: "u1",
      type: "new_message",
      inApp: false,
      email: false,
    });
    const prefs = await service.getPreferences("u1");
    const byType = Object.fromEntries(prefs.map((p) => [p.type, p]));
    expect(byType.new_message?.inApp).toBe(false);
    expect(byType.system?.inApp).toBe(true);
    expect(byType.system?.email).toBe(true);
  });

  it("rejects preference with unknown type", async () => {
    await expect(
      service.updatePreference({
        userId: "u1",
        type: "nope" as NotificationType,
        inApp: true,
        email: true,
      }),
    ).rejects.toMatchObject({ code: "INVALID_NOTIFICATION_TYPE" });
  });
});

describe("NotificationsEventConsumer", () => {
  it("emits one notification per supported event type", async () => {
    const repo = new InMemoryNotificationRepository();
    const service = new NotificationsService(repo);
    const consumer = new NotificationsEventConsumer(service, async () => "host-1");
    const { bus } = makeBus();
    consumer.register(bus);

    await bus.publish({
      type: "UserRegisteredEvent",
      aggregateId: "u1",
      payload: { userId: "u1", provider: "local" },
    });
    await bus.publish({
      type: "ConnectionAcceptedEvent",
      aggregateId: "c1",
      payload: { connectionId: "c1", requesterId: "req", addresseeId: "addr" },
    });
    await bus.publish({
      type: "ListingModeratedEvent",
      aggregateId: "l1",
      payload: { listingId: "l1", status: "approved" },
    });
    await bus.publish({
      type: "MessageSentEvent",
      aggregateId: "m1",
      payload: {
        messageId: 1,
        roomId: "r1",
        senderId: "sender",
        recipientId: "recipient",
        preview: "hola",
      },
    });

    const user1 = await service.list("u1");
    const requester = await service.list("req");
    const host = await service.list("host-1");
    const recipient = await service.list("recipient");

    expect(user1[0]?.type).toBe("system");
    expect(requester[0]?.type).toBe("connection_accepted");
    expect(host[0]?.type).toBe("listing_moderated");
    expect(recipient[0]?.type).toBe("new_message");
  });

  it("ignores unknown event types without crashing", async () => {
    const repo = new InMemoryNotificationRepository();
    const service = new NotificationsService(repo);
    const consumer = new NotificationsEventConsumer(service, async () => null);
    const { bus, outboxEvents } = makeBus();
    consumer.register(bus);

    await bus.publish({ type: "SomethingElse", aggregateId: "x", payload: {} });
    expect(outboxEvents).toHaveLength(1); // outbox siempre persiste
    expect(repo.items.size).toBe(0);
  });

  it("does not break publish when a listener throws", async () => {
    const outboxEvents: string[] = [];
    const bus = new InProcessEventBus({
      publish: async (event) => {
        outboxEvents.push(event.type);
      },
    });
    bus.subscribe(() => {
      throw new Error("boom");
    });
    await bus.publish({ type: "X", aggregateId: "1", payload: {} });
    expect(outboxEvents).toEqual(["X"]);
  });
});
