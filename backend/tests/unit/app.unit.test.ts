import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";

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
});
