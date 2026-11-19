import { describe, expect, it } from "vitest";
import {
  ActivityLogEntry,
  type ActivityLogFilter,
  type IActivityLogRepository,
} from "../../src/domain/index.js";
import {
  ActivityLogConsumer,
  ActivityLogService,
} from "../../src/modules/activity-log/index.js";
import {
  InProcessEventBus,
} from "../../src/modules/notifications/event-bus.js";
import type { DomainEventPublisher } from "../../src/modules/auth/index.js";

class InMemoryActivityLogRepository implements IActivityLogRepository {
  readonly entries: ActivityLogEntry[] = [];
  async create(entry: ActivityLogEntry) {
    this.entries.push(entry);
    return entry;
  }
  async list(filter: ActivityLogFilter = {}) {
    return this.entries
      .filter((e) => !filter.userId || e.userId === filter.userId)
      .filter((e) => !filter.action || e.action === filter.action)
      .filter((e) => !filter.from || e.createdAt >= filter.from)
      .filter((e) => !filter.to || e.createdAt <= filter.to)
      .slice(filter.offset ?? 0, (filter.offset ?? 0) + (filter.limit ?? 50));
  }
  async count(filter: ActivityLogFilter = {}) {
    return (await this.list({ ...filter, limit: Number.MAX_SAFE_INTEGER, offset: 0 })).length;
  }
}

describe("ActivityLogService", () => {
  it("stores action with payload as metadata", async () => {
    const repo = new InMemoryActivityLogRepository();
    const service = new ActivityLogService(repo, () => new Date("2026-11-07T00:00:00Z"));
    await service.log({ userId: "u1", action: "LoginSucceededEvent", metadata: { ip: "1.1.1.1" } });
    expect(repo.entries).toHaveLength(1);
    expect(repo.entries[0]?.action).toBe("LoginSucceededEvent");
    expect(repo.entries[0]?.metadata).toEqual({ ip: "1.1.1.1" });
  });

  it("filters list by userId, action and time range", async () => {
    const repo = new InMemoryActivityLogRepository();
    const t0 = new Date("2026-11-07T10:00:00Z");
    const t1 = new Date("2026-11-07T11:00:00Z");
    const t2 = new Date("2026-11-07T12:00:00Z");
    repo.entries.push(
      new ActivityLogEntry({ userId: "u1", action: "X", metadata: {}, ipAddress: null, createdAt: t0 }),
      new ActivityLogEntry({ userId: "u2", action: "Y", metadata: {}, ipAddress: null, createdAt: t1 }),
      new ActivityLogEntry({ userId: "u1", action: "Y", metadata: {}, ipAddress: null, createdAt: t2 }),
    );
    const service = new ActivityLogService(repo);
    expect((await service.list({ userId: "u1" })).length).toBe(2);
    expect((await service.list({ action: "Y" })).length).toBe(2);
    expect((await service.list({ userId: "u1", action: "Y" })).length).toBe(1);
    expect((await service.list({ from: t1, to: t1 })).length).toBe(1);
  });
});

describe("ActivityLogConsumer", () => {
  it("persists every event published to the bus using event.type as action", async () => {
    const repo = new InMemoryActivityLogRepository();
    const service = new ActivityLogService(repo);
    const outbox: DomainEventPublisher = { publish: async () => {} };
    const bus = new InProcessEventBus(outbox);
    new ActivityLogConsumer(service).register(bus);

    await bus.publish({
      type: "LoginSucceededEvent",
      aggregateId: "u1",
      payload: { userId: "u1", ipAddress: "9.9.9.9" },
    });
    await bus.publish({
      type: "SanctionIssuedEvent",
      aggregateId: "s1",
      payload: { userId: "target", adminId: "admin-1", type: "warning" },
    });
    await bus.publish({
      type: "AnythingElse",
      aggregateId: "x",
      payload: { foo: "bar" },
    });

    expect(repo.entries.map((e) => e.action)).toEqual([
      "LoginSucceededEvent",
      "SanctionIssuedEvent",
      "AnythingElse",
    ]);
    expect(repo.entries[0]?.userId).toBe("u1");
    expect(repo.entries[0]?.ipAddress).toBe("9.9.9.9");
    // SanctionIssuedEvent trae userId (target) y lo usa como actor.
    expect(repo.entries[1]?.userId).toBe("target");
    // Evento sin userId/actorId/adminId → actor null.
    expect(repo.entries[2]?.userId).toBeNull();
  });
});

describe("ActivityLogEntry", () => {
  it("requires action", () => {
    expect(
      () =>
        new ActivityLogEntry({
          userId: null,
          action: "  ",
          metadata: {},
          ipAddress: null,
          createdAt: new Date(),
        }),
    ).toThrow();
  });
});
