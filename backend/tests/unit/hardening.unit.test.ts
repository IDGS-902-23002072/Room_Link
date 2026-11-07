import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { User } from "../../src/domain/entities/User.js";
import type {
  INotificationRepository,
  ListNotificationsFilter,
  NotificationPreference,
  NotificationType,
  Notification,
} from "../../src/domain/index.js";
import {
  InMemoryUserRepository,
  createAuthFakes,
} from "../helpers/auth-fakes.js";

class StubNotificationRepository implements INotificationRepository {
  async list(_userId: string, _filter?: ListNotificationsFilter): Promise<Notification[]> {
    return [];
  }
  async countUnread() {
    return 0;
  }
  async findById() {
    return null;
  }
  async create(n: Notification) {
    return n;
  }
  async markRead() {}
  async markAllRead() {
    return 0;
  }
  async getPreferences(): Promise<NotificationPreference[]> {
    return [];
  }
  async getPreferenceFor(_u: string, _t: NotificationType) {
    return null;
  }
  async upsertPreference(p: NotificationPreference) {
    return p;
  }
}

/**
 * Hardening RNF-02/RNF-05:
 * - Ningún payload público puede contener campos de hash o secretos del server.
 * - Toda respuesta HTTP incluye las cabeceras de seguridad transversales.
 *
 * Qué consideramos prohibido:
 *   - Keys exactas: passwordHash, tokenHash, passwordHashField, resetTokenHash,
 *     sessionTokenHash, refreshTokenHash, secret.
 *   - Cualquier key que termine en "Hash" (case insensitive).
 *
 * Qué NO es prohibido (se devuelve a propósito):
 *   - `token`: el token de sesión del cliente, entregado tras login OAuth/local.
 *   - `rulesSnapshot`, `metadata`, `payload`: contenido de agreements/actividad.
 */
const FORBIDDEN_LITERAL_KEYS = new Set([
  "passwordHash",
  "tokenHash",
  "passwordHashField",
  "resetTokenHash",
  "sessionTokenHash",
  "refreshTokenHash",
  "secret",
]);

function assertNoForbiddenKeys(value: unknown, path = "$"): void {
  if (Array.isArray(value)) {
    value.forEach((item, idx) => assertNoForbiddenKeys(item, `${path}[${idx}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      if (FORBIDDEN_LITERAL_KEYS.has(key)) {
        throw new Error(`${path}.${key} es una clave prohibida en respuestas.`);
      }
      if (/hash$/i.test(key)) {
        throw new Error(
          `${path}.${key} termina en "Hash" y no debe salir al cliente.`,
        );
      }
      assertNoForbiddenKeys(
        (value as Record<string, unknown>)[key],
        `${path}.${key}`,
      );
    }
  }
}

const SECURITY_HEADERS = [
  ["X-Content-Type-Options", "nosniff"],
  ["Referrer-Policy", "no-referrer"],
  ["X-Frame-Options", "DENY"],
] as const;

function assertSecurityHeaders(res: Response): void {
  for (const [name, value] of SECURITY_HEADERS) {
    expect(res.headers.get(name), name).toBe(value);
  }
}

function buildApp() {
  const userRepo = new InMemoryUserRepository();
  const now = new Date("2026-11-07T12:00:00.000Z");
  userRepo.users.set(
    "u1",
    new User({
      id: "u1",
      email: "u1@roomlink.test",
      passwordHash: "hash:password",
      status: "active",
      roles: ["seeker"],
      termsAcceptedAt: now,
      createdAt: now,
      updatedAt: now,
    }),
  );
  const authFakes = createAuthFakes();
  const app = createApp({
    userRepo,
    authDependencies: authFakes.dependencies,
    notificationRepo: new StubNotificationRepository(),
  });
  return { app };
}

async function login(app: ReturnType<typeof buildApp>["app"]): Promise<string> {
  const res = await app.request("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "u1@roomlink.test", password: "password" }),
  });
  expect(res.status).toBe(200);
  return (await res.clone().json()).token as string;
}

describe("Hardening de respuestas", () => {
  it("login response no incluye campos de hash", async () => {
    const { app } = buildApp();
    const res = await app.request("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "u1@roomlink.test", password: "password" }),
    });
    assertSecurityHeaders(res);
    const body = await res.json();
    assertNoForbiddenKeys(body);
    // Guarda contra regresión: `token` está, `passwordHash` no.
    expect(body.token).toBeDefined();
    expect(body.user?.passwordHash).toBeUndefined();
  });

  it("GET /me devuelve el DTO sin campos sensibles", async () => {
    const { app } = buildApp();
    const token = await login(app);
    const res = await app.request("/api/v1/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    assertSecurityHeaders(res);
    assertNoForbiddenKeys(await res.json());
  });

  it("GET /notifications (vacío) y /health respetan headers y DTOs", async () => {
    const { app } = buildApp();
    const token = await login(app);
    const notif = await app.request("/api/v1/notifications", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(notif.status).toBe(200);
    assertSecurityHeaders(notif);
    assertNoForbiddenKeys(await notif.json());

    const health = await app.request("/health");
    expect(health.status).toBe(200);
    assertSecurityHeaders(health);
    assertNoForbiddenKeys(await health.json());
  });

  it("Error responses también llevan los headers de seguridad", async () => {
    const { app } = buildApp();
    const res = await app.request("/api/v1/notifications");
    expect(res.status).toBe(401);
    assertSecurityHeaders(res);
    assertNoForbiddenKeys(await res.json());
  });

  it("El helper detecta claves prohibidas cuando existen (contra-prueba)", () => {
    expect(() => assertNoForbiddenKeys({ passwordHash: "x" })).toThrow();
    expect(() => assertNoForbiddenKeys({ user: { tokenHash: "x" } })).toThrow();
    expect(() => assertNoForbiddenKeys({ list: [{ fooHash: "x" }] })).toThrow();
    expect(() => assertNoForbiddenKeys({ ok: true, items: [] })).not.toThrow();
  });
});
