import { beforeEach, describe, expect, it } from "vitest";
import {
  Sanction,
  type ISanctionRepository,
} from "../../src/domain/index.js";
import { SanctionsService } from "../../src/modules/sanctions/index.js";
import type { DomainEventPublisher } from "../../src/modules/auth/index.js";

class InMemorySanctionRepository implements ISanctionRepository {
  readonly items = new Map<string, Sanction>();

  async findById(id: string) {
    return this.items.get(id) ?? null;
  }
  async listForUser(userId: string) {
    return Array.from(this.items.values()).filter((s) => s.userId === userId);
  }
  async listActiveForUser(userId: string, at: Date) {
    return (await this.listForUser(userId)).filter((s) => s.isActive(at));
  }
  async listForListing(listingId: string) {
    return Array.from(this.items.values()).filter((s) => s.listingId === listingId);
  }
  async create(sanction: Sanction) {
    this.items.set(sanction.id, sanction);
    return sanction;
  }
  async revoke(id: string, at: Date) {
    const s = this.items.get(id);
    if (s) s.expiresAt = at;
  }
}

describe("SanctionsService", () => {
  let repo: InMemorySanctionRepository;
  let events: Array<{ type: string }>;
  let publisher: DomainEventPublisher;
  let service: SanctionsService;
  const now = new Date("2026-11-07T12:00:00Z");

  beforeEach(() => {
    repo = new InMemorySanctionRepository();
    events = [];
    publisher = { publish: async (event) => void events.push(event) };
    service = new SanctionsService(repo, publisher, () => now);
  });

  it("issues a warning and publishes SanctionIssuedEvent", async () => {
    const sanction = await service.issue({
      adminId: "admin-1",
      userId: "user-1",
      type: "warning",
      reason: "Lenguaje agresivo",
    });
    expect(sanction.type).toBe("warning");
    expect(sanction.expiresAt).toBeNull();
    expect(events).toMatchObject([{ type: "SanctionIssuedEvent" }]);
    expect(repo.items.size).toBe(1);
  });

  it("requires expiresAt for temporary_suspension and rejects past expirations", async () => {
    await expect(
      service.issue({
        adminId: "admin-1",
        userId: "u1",
        type: "temporary_suspension",
        reason: "x",
      }),
    ).rejects.toMatchObject({ code: "SANCTION_EXPIRATION_REQUIRED" });

    await expect(
      service.issue({
        adminId: "admin-1",
        userId: "u1",
        type: "temporary_suspension",
        reason: "x",
        expiresAt: new Date("2000-01-01T00:00:00Z"),
      }),
    ).rejects.toMatchObject({ code: "SANCTION_EXPIRATION_IN_PAST" });
  });

  it("rejects unknown type and missing reason/target", async () => {
    await expect(
      service.issue({
        adminId: "admin-1",
        userId: "u1",
        type: "oops" as any,
        reason: "x",
      }),
    ).rejects.toMatchObject({ code: "INVALID_SANCTION_TYPE" });

    await expect(
      service.issue({
        adminId: "admin-1",
        userId: "u1",
        type: "warning",
        reason: "   ",
      }),
    ).rejects.toMatchObject({ code: "SANCTION_REASON_REQUIRED" });

    await expect(
      service.issue({
        adminId: "admin-1",
        type: "warning",
        reason: "motivo",
      }),
    ).rejects.toMatchObject({ code: "SANCTION_TARGET_REQUIRED" });
  });

  it("findBlockingSession finds active suspension and ignores expired ones", async () => {
    const future = new Date(now.getTime() + 60 * 60 * 1000);
    await service.issue({
      adminId: "admin-1",
      userId: "user-1",
      type: "temporary_suspension",
      reason: "spam",
      expiresAt: future,
    });
    expect(await service.findBlockingSession("user-1")).not.toBeNull();

    // Vencerla
    await service.revoke(Array.from(repo.items.values())[0]!.id);
    expect(await service.findBlockingSession("user-1")).toBeNull();
  });

  it("warnings do not block the session", async () => {
    await service.issue({
      adminId: "admin-1",
      userId: "user-1",
      type: "warning",
      reason: "aviso",
    });
    expect(await service.findBlockingSession("user-1")).toBeNull();
  });

  it("revoke 404 and 409", async () => {
    await expect(service.revoke("nope")).rejects.toMatchObject({
      code: "SANCTION_NOT_FOUND",
    });
    const past = new Date(now.getTime() - 60 * 1000);
    repo.items.set(
      "s1",
      new Sanction({
        id: "s1",
        reportId: null,
        adminId: "admin-1",
        userId: "u1",
        listingId: null,
        type: "temporary_suspension",
        reason: "r",
        expiresAt: past,
        createdAt: new Date(now.getTime() - 3600 * 1000),
      }),
    );
    await expect(service.revoke("s1")).rejects.toMatchObject({
      code: "SANCTION_NOT_ACTIVE",
    });
  });
});

describe("Sanction entity", () => {
  it("permanent_ban without expiresAt stays active forever", () => {
    const s = new Sanction({
      id: "s",
      reportId: null,
      adminId: "a",
      userId: "u",
      listingId: null,
      type: "permanent_ban",
      reason: "r",
      expiresAt: null,
      createdAt: new Date("2000-01-01Z"),
    });
    expect(s.isActive(new Date("3000-01-01Z"))).toBe(true);
    expect(s.blocksSession(new Date("3000-01-01Z"))).toBe(true);
  });

  it("dismissed never blocks", () => {
    const s = new Sanction({
      id: "s",
      reportId: null,
      adminId: "a",
      userId: "u",
      listingId: null,
      type: "dismissed",
      reason: "r",
      expiresAt: null,
      createdAt: new Date(),
    });
    expect(s.isActive(new Date())).toBe(false);
    expect(s.blocksSession(new Date())).toBe(false);
  });

  it("requires target and reason", () => {
    expect(
      () =>
        new Sanction({
          id: "s",
          reportId: null,
          adminId: "a",
          userId: null,
          listingId: null,
          type: "warning",
          reason: "r",
          expiresAt: null,
          createdAt: new Date(),
        }),
    ).toThrow();
    expect(
      () =>
        new Sanction({
          id: "s",
          reportId: null,
          adminId: "a",
          userId: "u",
          listingId: null,
          type: "warning",
          reason: "",
          expiresAt: null,
          createdAt: new Date(),
        }),
    ).toThrow();
  });
});
