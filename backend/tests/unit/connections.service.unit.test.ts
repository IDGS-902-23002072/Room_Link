import { beforeEach, describe, expect, it } from "vitest";
import {
  Connection,
  type ConnectionDirection,
  type IConnectionRepository,
} from "../../src/domain/index.js";
import { ConnectionsService } from "../../src/modules/connections/index.js";
import type { DomainEventPublisher } from "../../src/modules/auth/index.js";

interface DomainEvent {
  type: string;
  aggregateId: string;
  payload: Record<string, unknown>;
}

class InMemoryConnectionRepository implements IConnectionRepository {
  readonly items = new Map<string, Connection>();
  async findById(id: string) {
    return this.items.get(id) ?? null;
  }
  async listForUser(userId: string, direction: ConnectionDirection) {
    return Array.from(this.items.values()).filter((c) => {
      if (direction === "incoming") return c.addresseeId === userId;
      if (direction === "outgoing") return c.requesterId === userId;
      return c.addresseeId === userId || c.requesterId === userId;
    });
  }
  async update(connection: Connection) {
    this.items.set(connection.id, connection);
  }
}

function makePending(id: string, requesterId = "req", addresseeId = "addr"): Connection {
  return new Connection({
    id,
    requesterId,
    addresseeId,
    status: "pending",
    introMessage: null,
    responseMessage: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    respondedAt: null,
  });
}

function createFixedClock(): () => Date {
  return () => new Date("2026-11-07T00:00:00Z");
}

describe("ConnectionsService", () => {
  let repo: InMemoryConnectionRepository;
  let events: DomainEvent[];
  let publisher: DomainEventPublisher;
  let service: ConnectionsService;

  beforeEach(() => {
    repo = new InMemoryConnectionRepository();
    events = [];
    publisher = { publish: async (event) => void events.push(event) };
    service = new ConnectionsService(repo, publisher, createFixedClock());
  });

  it("only the addressee can respond", async () => {
    const connection = makePending("c1");
    repo.items.set(connection.id, connection);

    await expect(
      service.respond({ connectionId: "c1", userId: "req", decision: "accept" }),
    ).rejects.toMatchObject({ status: 403, code: "CONNECTION_FORBIDDEN" });
  });

  it("accept transitions status and emits ConnectionAcceptedEvent", async () => {
    const connection = makePending("c2");
    repo.items.set(connection.id, connection);

    const updated = await service.respond({
      connectionId: "c2",
      userId: "addr",
      decision: "accept",
      responseMessage: "Bienvenido",
    });

    expect(updated.status).toBe("accepted");
    expect(updated.responseMessage).toBe("Bienvenido");
    expect(updated.respondedAt).toEqual(new Date("2026-11-07T00:00:00Z"));
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("ConnectionAcceptedEvent");
    expect(events[0]?.payload).toMatchObject({
      connectionId: "c2",
      requesterId: "req",
      addresseeId: "addr",
    });
  });

  it("reject does not emit any event", async () => {
    const connection = makePending("c3");
    repo.items.set(connection.id, connection);

    const updated = await service.respond({
      connectionId: "c3",
      userId: "addr",
      decision: "reject",
    });

    expect(updated.status).toBe("rejected");
    expect(events).toHaveLength(0);
  });

  it("cannot respond twice on the same connection", async () => {
    const connection = makePending("c4");
    repo.items.set(connection.id, connection);

    await service.respond({ connectionId: "c4", userId: "addr", decision: "accept" });

    await expect(
      service.respond({ connectionId: "c4", userId: "addr", decision: "reject" }),
    ).rejects.toMatchObject({ status: 409, code: "CONNECTION_ALREADY_RESOLVED" });
  });

  it("rejects response message over 500 chars", async () => {
    const connection = makePending("c5");
    repo.items.set(connection.id, connection);

    await expect(
      service.respond({
        connectionId: "c5",
        userId: "addr",
        decision: "accept",
        responseMessage: "x".repeat(501),
      }),
    ).rejects.toMatchObject({ code: "CONNECTION_MESSAGE_TOO_LONG" });
  });

  it("only the requester can cancel", async () => {
    const connection = makePending("c6");
    repo.items.set(connection.id, connection);

    await expect(
      service.cancel("c6", "addr"),
    ).rejects.toMatchObject({ status: 403, code: "CONNECTION_FORBIDDEN" });

    const cancelled = await service.cancel("c6", "req");
    expect(cancelled.status).toBe("cancelled");
  });

  it("returns 404 when the connection does not exist", async () => {
    await expect(
      service.respond({ connectionId: "nope", userId: "addr", decision: "accept" }),
    ).rejects.toMatchObject({ status: 404, code: "CONNECTION_NOT_FOUND" });
    await expect(service.cancel("nope", "req")).rejects.toMatchObject({
      status: 404,
      code: "CONNECTION_NOT_FOUND",
    });
  });

  it("rejects construction when requester and addressee are the same", () => {
    expect(
      () =>
        new Connection({
          id: "c7",
          requesterId: "same",
          addresseeId: "same",
          status: "pending",
          introMessage: null,
          responseMessage: null,
          createdAt: new Date(),
          respondedAt: null,
        }),
    ).toThrow();
  });

  it("lists by direction", async () => {
    repo.items.set("c8", makePending("c8", "u1", "u2"));
    repo.items.set("c9", makePending("c9", "u2", "u3"));

    const incoming = await service.listForUser("u2", "incoming");
    const outgoing = await service.listForUser("u2", "outgoing");
    const all = await service.listForUser("u2", "all");

    expect(incoming.map((c) => c.id)).toEqual(["c8"]);
    expect(outgoing.map((c) => c.id)).toEqual(["c9"]);
    expect(all.map((c) => c.id).sort()).toEqual(["c8", "c9"]);
  });
});
