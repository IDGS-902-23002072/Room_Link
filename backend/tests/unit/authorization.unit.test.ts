import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { User } from "../../src/domain/entities/User.js";
import type {
  CompatibilityFeedCandidate,
  ConnectionRequest,
  ICompatibilityRepository,
} from "../../src/domain/repositories/ICompatibilityRepository.js";
import { CompatibilityProfile } from "../../src/domain/entities/CompatibilityProfile.js";
import {
  InMemoryUserRepository,
  createAuthFakes,
} from "../helpers/auth-fakes.js";

/**
 * Tests de autorización RNF-01.2:
 * - Las rutas privadas de profile, rooms, applications y compatibility
 *   exigen sesión válida y derivan el actor de ella.
 * - El `:userId` en compatibility solo es accesible por el propio dueño o admin.
 */

class StubCompatibilityRepository implements ICompatibilityRepository {
  readonly active = new Set<string>();
  async isActiveUser(userId: string) {
    return this.active.has(userId);
  }
  async findByUserId() {
    return null;
  }
  async save() {}
  async findFeed() {
    return [] as CompatibilityFeedCandidate[];
  }
  async findCandidate() {
    return null;
  }
  async createConnection(
    requesterId: string,
    addresseeId: string,
  ): Promise<ConnectionRequest> {
    return {
      id: "c-1",
      requesterId,
      addresseeId,
      status: "pending",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    };
  }
}

function buildApp() {
  const userRepo = new InMemoryUserRepository();
  const now = new Date("2026-11-05T12:00:00.000Z");
  userRepo.users.set(
    "owner",
    new User({
      id: "owner",
      email: "owner@roomlink.test",
      passwordHash: "hash:password",
      status: "active",
      roles: ["seeker"],
      termsAcceptedAt: now,
      createdAt: now,
      updatedAt: now,
    }),
  );
  userRepo.users.set(
    "intruder",
    new User({
      id: "intruder",
      email: "intruder@roomlink.test",
      passwordHash: "hash:password",
      status: "active",
      roles: ["seeker"],
      termsAcceptedAt: now,
      createdAt: now,
      updatedAt: now,
    }),
  );
  const compatibilityRepo = new StubCompatibilityRepository();
  compatibilityRepo.active.add("owner");
  compatibilityRepo.active.add("intruder");
  const authFakes = createAuthFakes();
  const app = createApp({
    userRepo,
    compatibilityRepo,
    authDependencies: authFakes.dependencies,
  });
  return { app };
}

async function login(app: ReturnType<typeof buildApp>["app"], email: string) {
  const res = await app.request("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "password" }),
  });
  expect(res.status).toBe(200);
  return (await res.json()).token as string;
}

describe("Authorization gates (RNF-01.2)", () => {
  it("rejects anonymous requests on profile create, rooms create, applications and compatibility", async () => {
    const { app } = buildApp();

    const profile = await app.request("/api/v1/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(profile.status).toBe(401);

    const room = await app.request("/api/v1/rooms", {
      method: "POST",
      body: new FormData(),
    });
    expect(room.status).toBe(401);

    const applied = await app.request("/api/v1/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(applied.status).toBe(401);

    const compat = await app.request("/api/v1/compatibility/owner");
    expect(compat.status).toBe(401);
  });

  it("forbids access when the authenticated user does not match :userId in compatibility", async () => {
    const { app } = buildApp();
    const intruderToken = await login(app, "intruder@roomlink.test");

    const res = await app.request("/api/v1/compatibility/owner", {
      headers: { Authorization: `Bearer ${intruderToken}` },
    });
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows the owner to access their own compatibility test", async () => {
    const { app } = buildApp();
    const ownerToken = await login(app, "owner@roomlink.test");

    const res = await app.request("/api/v1/compatibility/owner", {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    expect(res.status).toBe(200);
  });
});
