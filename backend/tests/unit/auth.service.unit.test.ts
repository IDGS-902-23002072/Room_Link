import { describe, expect, it } from "vitest";
import { AuthService } from "../../src/modules/auth/index.js";
import { createAuthFakes, InMemoryUserRepository, MutableClock } from "../helpers/auth-fakes.js";

const register = (service: AuthService, overrides: Record<string, unknown> = {}) =>
  service.register({
    email: "cesar@roomlink.test",
    password: "Segura123",
    termsAccepted: true,
    ...overrides,
  });

describe("AuthService", () => {
  it("requires explicit terms and a password of at least 8 characters", async () => {
    const users = new InMemoryUserRepository();
    const fakes = createAuthFakes();
    const service = new AuthService(users, fakes.dependencies);

    await expect(register(service, { termsAccepted: false })).rejects.toMatchObject({
      code: "TERMS_REQUIRED",
    });
    await expect(register(service, { password: "1234567" })).rejects.toMatchObject({
      code: "WEAK_PASSWORD",
    });
    expect(users.users.size).toBe(0);
  });

  it("normalizes email, hashes the password and publishes UserRegisteredEvent", async () => {
    const users = new InMemoryUserRepository();
    const fakes = createAuthFakes();
    const service = new AuthService(users, fakes.dependencies);

    const user = await register(service, { email: "  CESAR@RoomLink.Test " });

    expect(user.email).toBe("cesar@roomlink.test");
    expect(user.passwordHash).toBe("hash:Segura123");
    expect(fakes.events).toEqual([
      expect.objectContaining({
        type: "UserRegisteredEvent",
        aggregateId: user.id,
        payload: expect.objectContaining({ provider: "local" }),
      }),
    ]);
  });

  it("locks the account for 15 minutes after five consecutive failures", async () => {
    const clock = new MutableClock();
    const users = new InMemoryUserRepository();
    const fakes = createAuthFakes(clock);
    const service = new AuthService(users, fakes.dependencies);
    const user = await register(service);

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await expect(
        service.login({ email: user.email, password: "incorrecta" }),
      ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    }

    expect(user.failedLoginAttempts).toBe(5);
    expect(user.lockedUntil?.toISOString()).toBe("2026-11-05T12:15:00.000Z");
    await expect(
      service.login({ email: user.email, password: "Segura123" }),
    ).rejects.toMatchObject({ code: "ACCOUNT_LOCKED" });

    clock.advance(15);
    await expect(service.login({ email: user.email, password: "Segura123" })).resolves.toMatchObject({
      user,
      token: "token-1",
    });
    expect(user.failedLoginAttempts).toBe(0);
  });

  it("creates a single-use reset token that expires after 30 minutes and revokes sessions", async () => {
    const clock = new MutableClock();
    const users = new InMemoryUserRepository();
    const fakes = createAuthFakes(clock);
    const service = new AuthService(users, fakes.dependencies);
    const user = await register(service);
    await service.login({ email: user.email, password: "Segura123" });

    await service.requestPasswordReset(user.email);
    expect(fakes.emails).toHaveLength(1);
    expect(fakes.emails[0]?.expiresAt.toISOString()).toBe("2026-11-05T12:30:00.000Z");

    await service.resetPassword(fakes.emails[0]!.token, "NuevaSegura456");
    await expect(
      service.resetPassword(fakes.emails[0]!.token, "OtraSegura789"),
    ).rejects.toMatchObject({ code: "INVALID_RESET_TOKEN" });
    expect([...fakes.sessions.values()].every((session) => session.revokedAt)).toBe(true);
    await expect(service.login({ email: user.email, password: "NuevaSegura456" })).resolves.toBeDefined();
  });

  it("does not reveal whether an email exists during recovery", async () => {
    const users = new InMemoryUserRepository();
    const fakes = createAuthFakes();
    const service = new AuthService(users, fakes.dependencies);

    await expect(service.requestPasswordReset("unknown@roomlink.test")).resolves.toBeUndefined();
    expect(fakes.emails).toHaveLength(0);
  });

  it("registers and links a verified Google identity through the provider port", async () => {
    const users = new InMemoryUserRepository();
    const fakes = createAuthFakes();
    const service = new AuthService(users, fakes.dependencies);

    const result = await service.loginWithGoogle({ idToken: "verified", termsAccepted: true });

    expect(result.user.email).toBe("google@roomlink.test");
    expect(result.user.isEmailVerified()).toBe(true);
    expect(fakes.identities.get("google:google-user-1")).toBe(result.user.id);
    expect(fakes.events[0]?.payload).toMatchObject({ provider: "google" });
  });

  it("authenticates and revokes opaque sessions without storing the raw token", async () => {
    const users = new InMemoryUserRepository();
    const fakes = createAuthFakes();
    const service = new AuthService(users, fakes.dependencies);
    const user = await register(service);
    const result = await service.login({ email: user.email, password: "Segura123" });

    expect([...fakes.sessions.keys()]).toEqual([`digest:${result.token}`]);
    const principal = await service.authenticate(result.token);
    expect(principal).toMatchObject({ userId: user.id, roles: ["seeker"] });

    await service.logout(principal);
    await expect(service.authenticate(result.token)).rejects.toMatchObject({ code: "INVALID_SESSION" });
  });
});
