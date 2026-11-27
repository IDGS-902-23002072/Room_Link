import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, type AppDependencies } from "../../src/app.js";
import { RoomListing } from "../../src/domain/index.js";
import {
  BatchedMonitorWriter,
  type MonitorRecord,
  type MonitorSink,
} from "../../src/monitoring/writer.js";
import { emitTestRecord } from "../../src/monitoring/testRecordBridge.js";
import { createAuthFakes } from "../helpers/auth-fakes.js";
import {
  InMemoryRoomRepository,
  InMemoryUserRepository,
  buildUser,
} from "../helpers/in-memory-repos.js";

/**
 * Suite de disponibilidad de la app. Comprueba /health y /ready con la base
 * principal simulada, y verifica que cada sondeo deje un registro legible en
 * `mon_probe`. También comprueba que un usuario autenticado consulte el feed
 * de Explorar. No escribe en `roomlink`: los repositorios y `checkDatabase`
 * son inyectados.
 */
class CapturingSink implements MonitorSink {
  readonly records: MonitorRecord[] = [];
  async insert(records: MonitorRecord[]): Promise<void> {
    this.records.push(...records);
    for (const record of records) emitTestRecord(record);
  }
}

const writers: BatchedMonitorWriter[] = [];

afterEach(async () => {
  for (const writer of writers.splice(0)) await writer.close();
});

const makeApp = (
  checkDatabase: () => Promise<void>,
  dependencies: Partial<AppDependencies> = {},
) => {
  const sink = new CapturingSink();
  const writer = new BatchedMonitorWriter(sink, { batchSize: 100, intervalMs: 600_000 });
  writers.push(writer);
  const app = createApp({ monitorWriter: writer, checkDatabase, ...dependencies });
  const request = (
    path: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: string;
    } = {},
  ) =>
    app.request(path, {
      ...options,
      headers: {
        "x-roomlink-source": "test",
        "x-request-id": randomUUID(),
        ...options.headers,
      },
    });
  return { app, sink, writer, request };
};

const probes = (sink: CapturingSink) => sink.records.filter((record) => record.kind === "probe");

describe("Suite disponibilidad · sondeos automáticos de la app", () => {
  it(
    `[SLI T.1] /health responde sin depender de la base :: Se llamó /health; la app respondió 200 y dejó un sondeo que explica que puede atender peticiones :: Datos: petición etiquetada como prueba, sin correos ni identificadores :: Esperado: 200 con estado "ok" y sondeo correcto :: Obtenido: 200 con estado "ok" y sondeo correcto`,
    async () => {
      const { sink, writer, request } = makeApp(vi.fn().mockRejectedValue(new Error("base caída")));
      const response = await request("/health");
      expect(response.status).toBe(200);
      expect((await response.json() as { status?: string }).status).toBe("ok");

      await writer.flush();
      const probe = probes(sink)[0];
      expect(probe?.kind).toBe("probe");
      if (probe?.kind === "probe") {
        expect(probe.value.status).toBe("up");
        expect(probe.value.httpStatus).toBe(200);
        expect(probe.value.source).toBe("test");
        expect(probe.value.message).toContain("/health");
        expect(probe.value.message).toContain("atender las peticiones");
      }
    },
  );

  it(
    `[SLI T.1] /ready confirma que la base responde :: Se llamó /ready con la base disponible; la app respondió 200 y el sondeo quedó registrado como correcto :: Datos: base simulada disponible, petición etiquetada como prueba :: Esperado: 200 "ready" y sondeo "up" :: Obtenido: 200 "ready" y sondeo "up"`,
    async () => {
      const { sink, writer, request } = makeApp(vi.fn().mockResolvedValue(undefined));
      const response = await request("/ready");
      expect(response.status).toBe(200);
      expect((await response.json() as { status?: string }).status).toBe("ready");

      await writer.flush();
      const probe = probes(sink)[0];
      expect(probe?.kind).toBe("probe");
      if (probe?.kind === "probe") {
        expect(probe.value.status).toBe("up");
        expect(probe.value.message).toContain("/ready");
        expect(probe.value.message).toContain("base principal");
      }
    },
  );

  it(
    `[SLI T.2] /ready avisa cuando la base no responde :: Se llamó /ready con la base caída; la app respondió 503 y el sondeo explicó el problema sin detener el servicio :: Datos: base simulada caída, petición etiquetada como prueba :: Esperado: 503 "unavailable" y sondeo "down" :: Obtenido: 503 "unavailable" y sondeo "down"`,
    async () => {
      const { sink, writer, request } = makeApp(vi.fn().mockRejectedValue(new Error("base caída")));
      const response = await request("/ready");
      expect(response.status).toBe(503);
      expect((await response.json() as { status?: string }).status).toBe("unavailable");

      await writer.flush();
      const probe = probes(sink)[0];
      expect(probe?.kind).toBe("probe");
      if (probe?.kind === "probe") {
        expect(probe.value.status).toBe("down");
        expect(probe.value.httpStatus).toBe(503);
        expect(probe.value.message).toContain("no pudo conectarse");
      }
      expect(JSON.stringify(sink.records)).not.toContain("base caída");
    },
  );

  it(
    `[SLI T.2] La recuperación queda en la bitácora :: Se llamó /ready dos veces: primero falló y luego respondió. Los dos sondeos quedaron con mensajes distintos y el mismo formato :: Datos: base simulada caída y luego disponible :: Esperado: un sondeo "down" y otro "up" :: Obtenido: un sondeo "down" y otro "up"`,
    async () => {
      const checkDatabase = vi
        .fn()
        .mockRejectedValueOnce(new Error("base caída"))
        .mockResolvedValueOnce(undefined);
      const { sink, writer, request } = makeApp(checkDatabase);

      expect((await request("/ready")).status).toBe(503);
      expect((await request("/ready")).status).toBe(200);
      await writer.flush();

      const statuses = probes(sink).map((record) =>
        record.kind === "probe" ? record.value.status : null,
      );
      expect(statuses).toEqual(["down", "up"]);
    },
  );

  it(
    `[SLI T.1] Usuario autenticado consulta un anuncio en Explorar :: Se inició sesión con una cuenta de prueba en repositorios en memoria y se consultó el feed que usa la pantalla Explorar; la API devolvió el anuncio publicado y la petición quedó trazada :: Datos: usuario y anuncio en memoria, sin escrituras en roomlink :: Esperado: login 200, /auth/me 200, feed 200 con el anuncio :: Obtenido: login 200, /auth/me 200, feed 200 con el anuncio`,
    async () => {
      const userId = "disponibilidad-explorar-usuario";
      const listingId = "disponibilidad-explorar-anuncio";
      const email = "disponibilidad-explorar@roomlink.test";
      const password = "password";
      const now = new Date("2026-11-27T12:00:00.000Z");

      const userRepo = new InMemoryUserRepository();
      userRepo.users.set(
        userId,
        buildUser({ id: userId, email, roles: ["seeker"], passwordPlain: password }),
      );

      const roomRepo = new InMemoryRoomRepository();
      roomRepo.rooms.set(
        listingId,
        new RoomListing({
          id: listingId,
          hostId: userId,
          title: "Habitación disponible QA",
          description: "Anuncio publicado para la prueba de disponibilidad.",
          monthlyRent: 3800,
          status: "published",
          photoCount: 3,
          publishedAt: now,
          createdAt: now,
          updatedAt: now,
        }),
      );

      const { sink, writer, request } = makeApp(
        vi.fn().mockResolvedValue(undefined),
        { userRepo, roomRepo, authDependencies: createAuthFakes().dependencies },
      );

      const login = await request("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      expect(login.status).toBe(200);
      const loginBody = (await login.json()) as {
        token?: string;
        user?: { id?: string };
      };
      expect(loginBody.user?.id).toBe(userId);
      expect(typeof loginBody.token).toBe("string");
      const token = loginBody.token ?? "";

      const me = await request("/api/v1/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(me.status).toBe(200);
      expect((await me.json() as { email?: string }).email).toBe(email);

      const feed = await request(
        "/api/v1/rooms/feed?page=1&pageSize=12&q=Habitaci%C3%B3n%20disponible",
        { headers: { Authorization: `Bearer ${token}` } },
      );
      expect(feed.status).toBe(200);
      const feedBody = (await feed.json()) as {
        items?: Array<{ id?: string; title?: string; monthlyRent?: number }>;
      };
      expect(feedBody.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: listingId,
            title: "Habitación disponible QA",
            monthlyRent: 3800,
          }),
        ]),
      );

      await writer.flush();
      const logged = JSON.stringify(sink.records);
      expect(logged).not.toContain(password);
      expect(logged).not.toContain(email);
      const routes = sink.records.flatMap((record) =>
        record.kind === "request" ? [record.value.routePattern] : [],
      );
      expect(routes).toEqual(
        expect.arrayContaining([
          "/api/v1/auth/login",
          "/api/v1/auth/me",
          "/api/v1/rooms/feed",
        ]),
      );
    },
  );
});
