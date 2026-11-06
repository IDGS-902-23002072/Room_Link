import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { User } from "../../src/domain/entities/User.js";
import type { IUserRepository } from "../../src/domain/repositories/IUserRepository.js";
import type { IAnalyticsRepository } from "../../src/domain/repositories/IAnalyticsRepository.js";

function createUser(role: "admin" | "seeker") {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return new User({
    id: `${role}-user`,
    email: `${role}@roomlink.test`,
    passwordHash: "mock_hash_password",
    status: "active",
    roles: [role],
    termsAcceptedAt: now,
    createdAt: now,
    updatedAt: now,
  });
}

describe("Room_Link API health", () => {
  it("reports process health without consulting MySQL", async () => {
    const checkDatabase = vi.fn<() => Promise<void>>();
    const app = createApp({ checkDatabase });

    const response = await app.request("/health");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      service: "room-link-backend",
    });
    expect(checkDatabase).not.toHaveBeenCalled();
  });

  it("reports readiness after MySQL answers", async () => {
    const checkDatabase = vi.fn<() => Promise<void>>().mockResolvedValue();
    const app = createApp({ checkDatabase });

    const response = await app.request("/ready");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "ready",
      database: "connected",
    });
    expect(checkDatabase).toHaveBeenCalledOnce();
  });

  it("returns 503 when MySQL is unavailable", async () => {
    const checkDatabase = vi
      .fn<() => Promise<void>>()
      .mockRejectedValue(new Error("connection refused"));
    const app = createApp({ checkDatabase });

    const response = await app.request("/ready");

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      status: "unavailable",
      database: "disconnected",
    });
  });

  it("allows the Vite web development origin for API requests", async () => {
    const app = createApp();

    const response = await app.request("/api/v1/auth/login", {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:5173",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization",
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "http://localhost:5173",
    );
    expect(response.headers.get("Access-Control-Allow-Headers")).toContain(
      "Authorization",
    );
  });

  it("serves dashboard metrics only to admins and validates the period", async () => {
    const admin = createUser("admin");
    const seeker = createUser("seeker");
    const userRepo: IUserRepository = {
      findById: async (id) => (id === admin.id ? admin : id === seeker.id ? seeker : null),
      findByEmail: async (email) =>
        email === admin.email ? admin : email === seeker.email ? seeker : null,
      create: async (user) => user,
      update: async () => {},
      delete: async () => {},
    };
    const analyticsRepo: IAnalyticsRepository = {
      getTotals: async () => ({
        usersRegistered: 10,
        activeRooms: 4,
        connectionsSent: 8,
        connectionsAccepted: 2,
        avgDaysToClose: 3.5,
      }),
      getUsersByMonth: async () => [{ month: "2026-01", total: 10 }],
      getListingsByMonth: async () => [{ month: "2026-01", total: 4 }],
    };
    const app = createApp({ userRepo, analyticsRepo });
    const adminLogin = await app.request("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: admin.email, password: "password" }),
    });
    const { token: adminToken } = await adminLogin.json();
    const seekerLogin = await app.request("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: seeker.email, password: "password" }),
    });
    const { token: seekerToken } = await seekerLogin.json();
    const query = "?start=2026-01-01&end=2026-03-31";

    const dashboardResponse = await app.request(
      `/api/v1/admin/analytics${query}`,
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    expect(dashboardResponse.status).toBe(200);
    await expect(dashboardResponse.json()).resolves.toMatchObject({
      kpis: { connectionAcceptanceRate: 25, activeRooms: 4 },
      monthlyUsers: [
        { month: "2026-01", total: 10 },
        { month: "2026-02", total: 0 },
        { month: "2026-03", total: 0 },
      ],
    });

    const forbiddenResponse = await app.request(`/api/v1/admin/analytics${query}`, {
      headers: { Authorization: `Bearer ${seekerToken}` },
    });
    expect(forbiddenResponse.status).toBe(403);

    const unauthenticatedResponse = await app.request(
      `/api/v1/admin/analytics${query}`,
    );
    expect(unauthenticatedResponse.status).toBe(401);

    const invalidDateResponse = await app.request(
      `/api/v1/admin/analytics${query.replace("2026-03-31", "2026-02-30")}`,
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    expect(invalidDateResponse.status).toBe(400);

    const longRangeResponse = await app.request(
      "/api/v1/admin/analytics?start=2025-01-01&end=2026-02-01",
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    expect(longRangeResponse.status).toBe(400);
  });
});
