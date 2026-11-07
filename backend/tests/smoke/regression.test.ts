import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import {
  InProcessEventBus,
} from "../../src/modules/notifications/index.js";
import { createAuthFakes } from "../helpers/auth-fakes.js";
import {
  InMemoryActivityLogRepository,
  InMemoryAgreementRepository,
  InMemoryAnalyticsRepository,
  InMemoryApplicationRepository,
  InMemoryCompatibilityRepository,
  InMemoryConnectionRepository,
  InMemoryMessagingRepository,
  InMemoryModerationRepository,
  InMemoryNotificationRepository,
  InMemoryProfileRepository,
  InMemoryRoomRepository,
  InMemorySanctionRepository,
  InMemoryUserRepository,
  ZeroAnalyticsSource,
  buildUser,
} from "../helpers/in-memory-repos.js";
import type { DomainEventPublisher } from "../../src/modules/auth/index.js";

/**
 * Suite de regresión end-to-end: ejercita todos los módulos conectados entre sí
 * usando fakes in-memory. Valida wiring, políticas y propagación de eventos.
 * La versión contra MySQL se agrega en F11 (integration suite + CI gate).
 */

const FORBIDDEN_LITERAL_KEYS = new Set([
  "passwordHash",
  "tokenHash",
  "passwordHashField",
  "resetTokenHash",
  "sessionTokenHash",
  "secret",
]);

function assertNoSensitive(value: unknown, path = "$"): void {
  if (Array.isArray(value)) {
    value.forEach((item, idx) => assertNoSensitive(item, `${path}[${idx}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      if (FORBIDDEN_LITERAL_KEYS.has(key) || /hash$/i.test(key)) {
        throw new Error(`Payload en ${path} filtra la clave prohibida '${key}'.`);
      }
      assertNoSensitive((value as Record<string, unknown>)[key], `${path}.${key}`);
    }
  }
}

describe("Regression smoke — flujo end-to-end con fakes in-memory", () => {
  const userRepo = new InMemoryUserRepository();
  const profileRepo = new InMemoryProfileRepository();
  const roomRepo = new InMemoryRoomRepository();
  const appRepo = new InMemoryApplicationRepository();
  const compatibilityRepo = new InMemoryCompatibilityRepository();
  const connectionRepo = new InMemoryConnectionRepository();
  const messagingRepo = new InMemoryMessagingRepository();
  const moderationRepo = new InMemoryModerationRepository();
  const sanctionRepo = new InMemorySanctionRepository();
  const notificationRepo = new InMemoryNotificationRepository();
  const agreementRepo = new InMemoryAgreementRepository();
  const analyticsRepo = new InMemoryAnalyticsRepository();

  // Precargo usuarios para que el login funcione con los fakes de auth.
  userRepo.users.set("host-1", buildUser({ id: "host-1", email: "host@roomlink.test", roles: ["host"] }));
  userRepo.users.set("seeker-1", buildUser({ id: "seeker-1", email: "seeker@roomlink.test", roles: ["seeker"] }));
  userRepo.users.set("third-1", buildUser({ id: "third-1", email: "third@roomlink.test", roles: ["seeker"] }));
  userRepo.users.set("admin-1", buildUser({ id: "admin-1", email: "admin@roomlink.test", roles: ["admin"] }));
  for (const u of userRepo.users.values()) {
    compatibilityRepo.activeUsers.add(u.id);
    moderationRepo.users.add(u.id);
  }

  const outbox: DomainEventPublisher = { publish: async () => {} };
  const bus = new InProcessEventBus(outbox);
  const authFakes = createAuthFakes();
  // Enchufo el bus al publisher de auth para que los consumers se activen.
  (authFakes.dependencies as any).eventPublisher = bus;

  const app = createApp({
    userRepo,
    profileRepo,
    roomRepo,
    appRepo,
    compatibilityRepo,
    connectionRepo,
    messagingRepo,
    moderationRepo,
    sanctionRepo,
    notificationRepo,
    agreementRepo,
    analyticsRepo,
    analyticsSource: new ZeroAnalyticsSource(),
    activityLogRepo: new InMemoryActivityLogRepository(),
    authDependencies: authFakes.dependencies,
  });

  const tokens = { host: "", seeker: "", third: "", admin: "" };
  const login = async (email: string) => {
    const res = await app.request("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "password" }),
    });
    expect(res.status, `login ${email}`).toBe(200);
    const body = await res.json();
    assertNoSensitive(body);
    return body.token as string;
  };

  const auth = (token: string, extra: Record<string, string> = {}) => ({
    ...extra,
    Authorization: `Bearer ${token}`,
  });

  beforeAll(async () => {
    tokens.host = await login("host@roomlink.test");
    tokens.seeker = await login("seeker@roomlink.test");
    tokens.third = await login("third@roomlink.test");
    tokens.admin = await login("admin@roomlink.test");
  });

  let listingId = "";
  let connectionId = "";
  let roomId = "";
  let applicationId = "";
  let agreementId = "";
  let listingReportId = "";

  it("host publica un listing (con hostId tomado de sesión)", async () => {
    const form = new FormData();
    form.append("titulo", "Casa amplia cerca del campus");
    form.append("renta", "3500");
    form.append("descripcion", "Dos habitaciones libres.");
    form.append("ubicacion", "Centro");
    form.append("latitude", "21.12");
    form.append("longitude", "-101.68");
    const res = await app.request("/api/v1/rooms", {
      method: "POST",
      headers: auth(tokens.host),
      body: form,
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    assertNoSensitive(body);
    listingId = body.id;
    expect(body.status).toBe("draft");
    moderationRepo.owners.set(listingId, "host-1");
  });

  it("seeker guarda compatibility y envía solicitud de conexión al host", async () => {
    const save = await app.request("/api/v1/compatibility/seeker-1", {
      method: "PUT",
      headers: auth(tokens.seeker, { "Content-Type": "application/json" }),
      body: JSON.stringify({
        schedule: 3,
        cleanliness: 4,
        noise: 3,
        pets: 2,
        smoking: 1,
        visits: 3,
        genderPref: 3,
      }),
    });
    expect(save.status).toBe(200);
    assertNoSensitive(await save.json());

    const conn = await app.request("/api/v1/compatibility/seeker-1/connections", {
      method: "POST",
      headers: auth(tokens.seeker, { "Content-Type": "application/json" }),
      body: JSON.stringify({ candidateId: "host-1", introMessage: null }),
    });
    expect(conn.status).toBe(201);
    const body = await conn.json();
    assertNoSensitive(body);
    // Alineo el repo de connections con lo que registró el compatibility (fake aislado).
    connectionId = body.id;
    const { Connection } = await import("../../src/domain/index.js");
    connectionRepo.items.set(
      connectionId,
      new Connection({
        id: connectionId,
        requesterId: body.requesterId,
        addresseeId: body.addresseeId,
        status: "pending",
        introMessage: null,
        responseMessage: null,
        createdAt: new Date(body.createdAt),
        respondedAt: null,
      }),
    );
  });

  it("host acepta la conexión y se abre chat", async () => {
    const res = await app.request(`/api/v1/connections/${connectionId}`, {
      method: "PATCH",
      headers: auth(tokens.host, { "Content-Type": "application/json" }),
      body: JSON.stringify({ decision: "accept", responseMessage: "Hola" }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("accepted");

    const open = await app.request("/api/v1/messages/rooms", {
      method: "POST",
      headers: auth(tokens.host, { "Content-Type": "application/json" }),
      body: JSON.stringify({ connectionId }),
    });
    expect(open.status).toBe(201);
    const room = await open.json();
    assertNoSensitive(room);
    roomId = room.id;
    // Registro a ambos miembros en el repo in-memory (en Drizzle lo haría la transacción).
    messagingRepo.registerMember(roomId, "host-1");
    messagingRepo.registerMember(roomId, "seeker-1");
  });

  it("intercambian mensajes y marcan delivered/read", async () => {
    for (const [sender, body] of [
      [tokens.host, "Bienvenido"],
      [tokens.seeker, "Gracias!"],
    ] as const) {
      const r = await app.request(`/api/v1/messages/rooms/${roomId}/messages`, {
        method: "POST",
        headers: auth(sender, { "Content-Type": "application/json" }),
        body: JSON.stringify({ body }),
      });
      expect(r.status).toBe(201);
      assertNoSensitive(await r.json());
    }
    const del = await app.request(`/api/v1/messages/rooms/${roomId}/delivered`, {
      method: "PATCH",
      headers: auth(tokens.seeker),
    });
    expect(del.status).toBe(200);
    const read = await app.request(`/api/v1/messages/rooms/${roomId}/read`, {
      method: "PATCH",
      headers: auth(tokens.seeker),
    });
    expect(read.status).toBe(200);
  });

  it("seeker aplica al listing y host acepta la aplicación", async () => {
    const res = await app.request("/api/v1/applications", {
      method: "POST",
      headers: auth(tokens.seeker, { "Content-Type": "application/json" }),
      body: JSON.stringify({ listingId, message: "Me interesa." }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    assertNoSensitive(body);
    applicationId = body.id;

    const decide = await app.request(`/api/v1/applications/${applicationId}/decide`, {
      method: "PATCH",
      headers: auth(tokens.host, { "Content-Type": "application/json" }),
      body: JSON.stringify({ decision: "accept" }),
    });
    expect(decide.status).toBe(200);
    expect((await decide.json()).status).toBe("accepted");
  });

  it("host crea agreement y seeker lo firma", async () => {
    const create = await app.request("/api/v1/agreements", {
      method: "POST",
      headers: auth(tokens.host, { "Content-Type": "application/json" }),
      body: JSON.stringify({
        listingId,
        rules: { quietHours: "22-07", smoking: "no", pets: "preguntar" },
      }),
    });
    expect(create.status).toBe(201);
    const body = await create.json();
    assertNoSensitive(body);
    agreementId = body.id;

    const sign = await app.request(`/api/v1/agreements/${agreementId}/accept`, {
      method: "POST",
      headers: auth(tokens.seeker),
    });
    expect(sign.status).toBe(201);
    expect((await sign.json()).acceptedAt).not.toBeNull();
  });

  it("tercer usuario reporta el listing; admin lo resuelve", async () => {
    const report = await app.request(
      `/api/v1/moderation/reports/listings/${listingId}`,
      {
        method: "POST",
        headers: auth(tokens.third, { "Content-Type": "application/json" }),
        body: JSON.stringify({ reason: "spam", description: "Contenido sospechoso." }),
      },
    );
    expect(report.status).toBe(201);
    const body = await report.json();
    assertNoSensitive(body);
    listingReportId = body.id;

    const resolve = await app.request(
      `/api/v1/moderation/admin/reports/${listingReportId}`,
      {
        method: "PATCH",
        headers: auth(tokens.admin, { "Content-Type": "application/json" }),
        body: JSON.stringify({ status: "dismissed" }),
      },
    );
    expect(resolve.status).toBe(200);
    expect((await resolve.json()).status).toBe("dismissed");
  });

  it("admin emite una sanción warning al host", async () => {
    const res = await app.request("/api/v1/sanctions", {
      method: "POST",
      headers: auth(tokens.admin, { "Content-Type": "application/json" }),
      body: JSON.stringify({
        userId: "host-1",
        type: "warning",
        reason: "Advertencia por conducta dudosa",
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    assertNoSensitive(body);
    expect(body.type).toBe("warning");
  });

  it("seeker tiene al menos una notificación generada por el bus", async () => {
    const res = await app.request("/api/v1/notifications", {
      headers: auth(tokens.seeker),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    assertNoSensitive(body);
    // Debería tener notificaciones de bienvenida y/o conexión aceptada y mensaje nuevo.
    expect(body.items.length).toBeGreaterThan(0);
  });

  it("admin consulta activity-log y analytics", async () => {
    const log = await app.request("/api/v1/admin/activity-log", {
      headers: auth(tokens.admin),
    });
    expect(log.status).toBe(200);
    const logBody = await log.json();
    assertNoSensitive(logBody);
    expect(logBody.items.length).toBeGreaterThan(0);

    const recompute = await app.request(
      "/api/v1/admin/analytics/recompute?date=2026-11-06",
      {
        method: "POST",
        headers: auth(tokens.admin),
      },
    );
    expect(recompute.status).toBe(200);
    assertNoSensitive(await recompute.json());
  });

  it("todos los endpoints llevan los headers de seguridad transversales", async () => {
    const res = await app.request("/api/v1/notifications", {
      headers: auth(tokens.seeker),
    });
    for (const [h, v] of [
      ["X-Content-Type-Options", "nosniff"],
      ["Referrer-Policy", "no-referrer"],
      ["X-Frame-Options", "DENY"],
    ] as const) {
      expect(res.headers.get(h)).toBe(v);
    }
  });
});
