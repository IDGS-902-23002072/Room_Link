import { File } from "node:buffer";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { createMonitorActivityListener } from "../../src/monitoring/activityListener.js";
import {
  BatchedMonitorWriter,
  type MonitorRecord,
  type MonitorSink,
} from "../../src/monitoring/writer.js";
import { InProcessEventBus, type DomainEvent } from "../../src/modules/notifications/event-bus.js";
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
  InMemorySearchRepository,
  InMemoryUserRepository,
  ZeroAnalyticsSource,
  buildUser,
} from "../helpers/in-memory-repos.js";

/**
 * Suite funcional legible: exercises los módulos principales con datos aislados.
 * No hay Drizzle ni escrituras en `roomlink`: todo vive en memoria y desaparece
 * cuando termina el proceso. El patrón `mon-test-AAAAMMDD-xxxx` sirve para
 * localizar los datos si se revisa la bitácora de la corrida.
 */
const RUN_TAG = `mon-test-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 4)}`;
const DATA = `Datos ${RUN_TAG} en repositorios en memoria; sin escrituras en la base principal`;

class CapturingSink implements MonitorSink {
  readonly records: MonitorRecord[] = [];
  async insert(records: MonitorRecord[]): Promise<void> {
    this.records.push(...records);
  }
}

describe("Suite funcional · flujos principales con datos aislados", () => {
  const sink = new CapturingSink();
  const writer = new BatchedMonitorWriter(sink, { batchSize: 100, intervalMs: 600_000 });

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
  const searchRepo = new InMemorySearchRepository(profileRepo, roomRepo);

  const ids = {
    host: `${RUN_TAG}-host`,
    seeker: `${RUN_TAG}-seeker`,
    third: `${RUN_TAG}-third`,
  };
  for (const [id, role] of [
    [ids.host, "host"],
    [ids.seeker, "seeker"],
    [ids.third, "seeker"],
  ] as const) {
    const user = buildUser({
      id,
      email: `${id}@roomlink.test`,
      roles: [role],
    });
    userRepo.users.set(id, user);
    compatibilityRepo.activeUsers.add(id);
    moderationRepo.users.add(id);
  }

  const publishedEvents: DomainEvent[] = [];
  const outbox = {
    publish: async (event: DomainEvent) => {
      publishedEvents.push(event);
    },
  };
  const bus = new InProcessEventBus(outbox);
  bus.subscribe(createMonitorActivityListener(writer, "test"));
  const authFakes = createAuthFakes();
  authFakes.dependencies.eventPublisher = bus;

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
    searchRepo,
    analyticsSource: new ZeroAnalyticsSource(),
    activityLogRepo: new InMemoryActivityLogRepository(),
    authDependencies: authFakes.dependencies,
    monitorWriter: writer,
    checkDatabase: vi.fn(),
  });

  type RequestOptions = {
    method?: string;
    headers?: Record<string, string>;
    body?: string | FormData;
  };
  const request = (path: string, options: RequestOptions = {}) =>
    app.request(path, {
      ...options,
      headers: {
        "x-roomlink-source": "test",
        "x-request-id": randomUUID(),
        ...options.headers,
      },
    });

  const auth = (token: string, json = false) => ({
    Authorization: `Bearer ${token}`,
    ...(json ? { "Content-Type": "application/json" } : {}),
  });

  const login = async (email: string): Promise<string> => {
    const response = await request("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "password" }),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { token?: string };
    expect(typeof body.token).toBe("string");
    return body.token ?? "";
  };

  const tokens = { host: "", seeker: "", third: "" };
  let listingId = "";
  let applicationId = "";

  afterAll(async () => {
    await writer.close();
  });

  it(
    `[SLI 1.2] Inicio de sesión :: Se probó el acceso con cuentas válidas de anfitrión y solicitante; la API devolvió 200 y entregó sesión :: ${DATA} :: Esperado: 200 con token :: Obtenido: 200 con token`,
    async () => {
      tokens.host = await login(`${ids.host}@roomlink.test`);
      tokens.seeker = await login(`${ids.seeker}@roomlink.test`);
      tokens.third = await login(`${ids.third}@roomlink.test`);
      expect(tokens.host.length).toBeGreaterThan(0);
      expect(tokens.seeker.length).toBeGreaterThan(0);
      expect(tokens.third.length).toBeGreaterThan(0);
    },
  );

  it(
    `[SLI 7.1] Crear anuncio de habitación :: El anfitrión publicó un borrador; la app lo guardó con el título etiquetado :: ${DATA} :: Esperado: 201 en borrador :: Obtenido: 201 en borrador`,
    async () => {
      const form = new FormData();
      form.append("titulo", `Habitación ${RUN_TAG}`);
      form.append("renta", "3500");
      form.append("descripcion", `Anuncio de prueba ${RUN_TAG}`);
      form.append("ubicacion", "Centro");
      form.append("availableFrom", "2027-01-15");
      form.append("latitude", "21.12");
      form.append("longitude", "-101.68");
      const png = Buffer.from("89504e470d0a1a0a", "hex");
      for (let index = 1; index <= 3; index += 1) {
        // Node define File con un tipo distinto al Blob del DOM; en runtime es un Blob.
        const photo = new File([png], `foto-${index}.png`, { type: "image/png" });
        form.append("photos", photo as unknown as Blob);
      }

      const response = await request("/api/v1/rooms", {
        method: "POST",
        headers: auth(tokens.host),
        body: form,
      });
      expect(response.status).toBe(201);
      const body = (await response.json()) as { id?: string; status?: string };
      expect(body.status).toBe("draft");
      listingId = body.id ?? "";
      expect(listingId.length).toBeGreaterThan(0);
      moderationRepo.owners.set(listingId, ids.host);
    },
  );

  it(
    `[SLI 7.4] Publicar habitación :: El anfitrión activó el anuncio; la app cambió el estado de borrador a publicado :: ${DATA} :: Esperado: 200 publicada :: Obtenido: 200 publicada`,
    async () => {
      const rules = await request(`/api/v1/rooms/${listingId}/rules`, {
        method: "PUT",
        headers: auth(tokens.host, true),
        body: JSON.stringify({
          visitsPolicy: "Solo con aviso previo",
          partiesAllowed: false,
          quietHoursStart: "22:00",
          quietHoursEnd: "07:00",
          petsAllowed: false,
          smokingAllowed: false,
          commonAreasNotes: "Cocina compartida",
          extraRules: "",
        }),
      });
      expect(rules.status).toBe(200);

      const costs = await request(`/api/v1/rooms/${listingId}/costs`, {
        method: "PUT",
        headers: auth(tokens.host, true),
        body: JSON.stringify([
          {
            kind: "rent",
            concept: "Renta mensual",
            amount: 3500,
            isIncluded: false,
            isProrated: false,
          },
        ]),
      });
      expect(costs.status).toBe(200);

      const response = await request(`/api/v1/rooms/${listingId}/publish`, {
        method: "PATCH",
        headers: auth(tokens.host),
      });
      const body = (await response.json()) as { status?: string; error?: string };
      expect(response.status, body.error ?? "").toBe(200);
      expect(body.status).toBe("published");
      expect(roomRepo.rooms.get(listingId)?.status).toBe("published");
    },
  );

  it(
    `[SLI 9.1] Enviar postulación :: El solicitante aplicó al anuncio; la solicitud quedó pendiente y apareció en sus postulaciones :: ${DATA} :: Esperado: 201 pendiente :: Obtenido: 201 pendiente`,
    async () => {
      const response = await request("/api/v1/applications", {
        method: "POST",
        headers: auth(tokens.seeker, true),
        body: JSON.stringify({ listingId, message: `Interés de prueba ${RUN_TAG}` }),
      });
      expect(response.status).toBe(201);
      const body = (await response.json()) as { id?: string; status?: string };
      expect(body.status).toBe("pending");
      applicationId = body.id ?? "";

      const mine = await request("/api/v1/applications/me", {
        headers: auth(tokens.seeker),
      });
      expect(mine.status).toBe(200);
      expect(await mine.json()).toEqual([
        expect.objectContaining({ id: applicationId, listingId, status: "pending" }),
      ]);
    },
  );

  it(
    `[SLI 9.3] Aceptar postulación :: El anfitrión tomó la decisión; la app marcó la solicitud como aceptada y dejó un evento en la bitácora :: ${DATA} :: Esperado: 200 aceptada y bitácora sin datos sensibles :: Obtenido: 200 aceptada y bitácora saneada`,
    async () => {
      const response = await request(`/api/v1/applications/${applicationId}/decide`, {
        method: "PATCH",
        headers: auth(tokens.host, true),
        body: JSON.stringify({ decision: "accept" }),
      });
      expect(response.status).toBe(200);
      expect((await response.json() as { status?: string }).status).toBe("accepted");

      const event = publishedEvents.find(
        (item) => item.type === "ApplicationStatusChanged" && item.payload.status === "accepted",
      );
      expect(event).toBeDefined();
      expect(JSON.stringify(event?.payload)).not.toContain("password");
      expect(JSON.stringify(event?.payload)).not.toContain("roomlink.test");

      await writer.flush();
      const activity = sink.records.find(
        (record) => record.kind === "activity" && record.value.message.includes("postulación"),
      );
      expect(activity?.kind).toBe("activity");
      if (activity?.kind === "activity") {
        expect(activity.value.source).toBe("test");
        expect(activity.value.message).toContain("Se aceptó una postulación");
      }
    },
  );

  it(
    `Cerrar anuncio con la propia app :: El anfitrión cerró la publicación; el estado quedó closed sin borrar filas ni tocar la base principal :: ${DATA} :: Esperado: 200 cerrada :: Obtenido: 200 cerrada`,
    async () => {
      const response = await request(`/api/v1/rooms/${listingId}/close`, {
        method: "PATCH",
        headers: auth(tokens.host),
      });
      expect(response.status).toBe(200);
      expect((await response.json() as { status?: string }).status).toBe("closed");
      expect(roomRepo.rooms.get(listingId)?.status).toBe("closed");
    },
  );

  it(
    `Registro de la corrida :: Cada petición se etiquetó como prueba y se guardó como patrón de ruta, estado y duración; la bitácora no contiene correos ni secretos :: ${DATA} :: Esperado: registros etiquetados y sin datos sensibles :: Obtenido: registros etiquetados y sin datos sensibles`,
    async () => {
      await writer.flush();
      const requests = sink.records.filter((record) => record.kind === "request");
      expect(requests.length).toBeGreaterThan(0);
      expect(requests.every((record) => record.value.source === "test")).toBe(true);
      const serialized = JSON.stringify(sink.records);
      expect(serialized).not.toContain("password");
      expect(serialized).not.toContain("roomlink.test");
    },
  );
});
