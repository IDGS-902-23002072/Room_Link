import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { createMonitorActivityListener } from "../../src/monitoring/activityListener.js";
import { InProcessEventBus } from "../../src/modules/notifications/event-bus.js";
import type { AuthVariables } from "../../src/modules/auth/index.js";
import { describeDomainEvent, sanitizeDetail } from "../../src/monitoring/messageBuilder.js";
import { parseSource, shouldExclude, toRoutePattern } from "../../src/monitoring/routePattern.js";
import { monitorSchema } from "../../src/monitoring/schema.js";
import { createRequestLogger } from "../../src/monitoring/requestLogger.js";
import { SLI_CATALOG, findSliByRoute } from "../../src/monitoring/sliCatalog.js";
import {
  BatchedMonitorWriter,
  emitMonitorEvent,
  type MonitorRecord,
  type MonitorSink,
} from "../../src/monitoring/writer.js";

class CapturingSink implements MonitorSink {
  readonly records: MonitorRecord[] = [];
  async insert(records: MonitorRecord[]): Promise<void> {
    this.records.push(...records);
  }
}

class FailingSink implements MonitorSink {
  async insert(): Promise<void> {
    throw new Error("roomlink_monitor no disponible");
  }
}

const quietWriter = (sink: MonitorSink): BatchedMonitorWriter =>
  new BatchedMonitorWriter(sink, { batchSize: 100, intervalMs: 600_000 });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Fase 1 · base de monitoreo aislada", () => {
  it("define exactamente las 12 tablas del plan sin tablas inventadas", () => {
    expect(Object.keys(monitorSchema)).toEqual([
      "monRequestLog",
      "monError",
      "monActivityLog",
      "monProbe",
      "monBackupLog",
      "monSliCatalog",
      "monTestRun",
      "monTestResult",
      "monExclusion",
      "monSloCompliance",
      "monCaseEvent",
      "monIncident",
    ]);
  });

  it("carga los 67 SLI del SLA sin inventar rutas", () => {
    expect(SLI_CATALOG).toHaveLength(67);
    for (const sli of SLI_CATALOG) {
      expect(sli.id.length).toBeLessThanOrEqual(8);
    }
    const withoutRoute = SLI_CATALOG.filter((sli) => sli.routePattern === null).map(
      (sli) => sli.id,
    );
    // Los SLI de prueba (F3) tampoco tienen ruta HTTP; los cuatro de la lista
    // son los que el catálogo marca además como "sin dato".
    for (const id of ["1.4", "T.4", "T.5", "T.6"]) {
      expect(withoutRoute).toContain(id);
    }
  });

  it("asocia una petición real con su SLI y usa T.3 como respaldo", () => {
    expect(findSliByRoute("POST", "/api/v1/auth/login")?.id).toBe("1.2");
    expect(findSliByRoute("GET", "/api/v1/rooms/123")?.id).toBe("7.3");
    expect(findSliByRoute("GET", "/api/v1/no-existe")?.id).toBe("T.3");
  });
});

describe("F1 · reglas de privacidad y exclusión", () => {
  it("convierte identificadores en patrones sin conservar la URL original", () => {
    expect(toRoutePattern("/api/v1/rooms/123/rules")).toBe("/api/v1/rooms/:id/rules");
    const uuid = "9f8b7c6d-5e4a-3b2c-1d0e-abcdefabcdef";
    expect(toRoutePattern(`/api/v1/profiles/${uuid}`)).toBe("/api/v1/profiles/:id");
  });

  it("excluye el ruido fijo y acepta solo fuentes válidas", () => {
    expect(shouldExclude("OPTIONS", "/api/v1/rooms")).toBe(true);
    expect(shouldExclude("GET", "/health")).toBe(true);
    expect(shouldExclude("GET", "/ready")).toBe(true);
    expect(shouldExclude("GET", "/uploads/foto.png")).toBe(true);
    expect(
      shouldExclude("GET", "/api/v1/messages/rooms/abc/events"),
    ).toBe(true);
    expect(shouldExclude("GET", "/api/v1/rooms")).toBe(false);
    expect(parseSource("test")).toBe("test");
    expect(parseSource("synthetic")).toBe("synthetic");
    expect(parseSource(undefined)).toBe("real");
    expect(parseSource("otro")).toBe("real");
  });
});

describe("F1 · bitácora descriptiva sin datos sensibles", () => {
  it("explica un inicio de sesión rechazado sin guardar correo ni token", () => {
    const described = describeDomainEvent({
      type: "LoginFailedEvent",
      aggregateId: "u-1",
      payload: {
        reason: "invalid_password",
        email: "persona@correo.com",
        token: "secreto",
        password: "Password123!",
        ipAddress: "127.0.0.1",
      },
    });

    expect(described.result).toBe("rejected");
    expect(described.message).toContain("contraseña");
    expect(described.message).toContain("No se creó ninguna sesión");
    expect(JSON.stringify(described.detail)).not.toContain("persona@correo.com");
    expect(JSON.stringify(described.detail)).not.toContain("secreto");
    expect(JSON.stringify(described.detail)).not.toContain("Password123!");
    expect(JSON.stringify(described.detail)).not.toContain("127.0.0.1");
  });

  it("solo conserva claves inocuas en el detalle", () => {
    expect(
      sanitizeDetail({
        reason: "locked",
        status: "accepted",
        email: "x@y.test",
        body: { texto: "mensaje privado" },
        token: "abc",
      }),
    ).toEqual({ reason: "locked", status: "accepted" });
  });

  it("encola el evento del bus sin esperar a la base", async () => {
    const sink = new CapturingSink();
    const writer = quietWriter(sink);
    const bus = new InProcessEventBus({ publish: async () => undefined });
    bus.subscribe(createMonitorActivityListener(writer, "test"));

    await bus.publish({
      type: "ConnectionAcceptedEvent",
      aggregateId: "conn-1",
      payload: { connectionId: "conn-1", email: "oculto@correo.test" },
    });
    await writer.flush();

    const activity = sink.records.find((record) => record.kind === "activity");
    expect(activity?.kind).toBe("activity");
    if (activity?.kind === "activity") {
      expect(activity.value.message).toContain("chat habilitado");
      expect(activity.value.source).toBe("test");
      expect(JSON.stringify(activity.value.detail)).not.toContain("oculto@correo.test");
    }
    await writer.close();
  });
});

describe("F1 · escritor por lotes tolerante a fallos", () => {
  it("encola sin bloquear y escribe el lote cuando se solicita", async () => {
    const sink = new CapturingSink();
    const writer = quietWriter(sink);
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    writer.enqueue({
      kind: "request",
      value: {
        method: "GET",
        routePattern: "/api/v1/rooms",
        status: 200,
        durationMs: 10,
        isGood: 1,
        source: "real",
      },
    });
    expect(writer.pending).toBe(1);
    expect(sink.records).toHaveLength(0);

    await writer.flush();
    expect(sink.records).toHaveLength(1);
    expect(writer.pending).toBe(0);
    await writer.close();
  });

  it("descarta lo más antiguo cuando la cola se llena y lo reporta en JSON", async () => {
    const sink = new CapturingSink();
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const writer = new BatchedMonitorWriter(sink, {
      maxQueue: 2,
      batchSize: 100,
      intervalMs: 600_000,
    });

    for (const status of [200, 201, 202]) {
      writer.enqueue({
        kind: "request",
        value: {
          method: "GET",
          routePattern: "/api/v1/rooms",
          status,
          durationMs: 1,
          isGood: 1,
          source: "real",
        },
      });
    }
    await writer.flush();

    expect(writer.discarded).toBe(1);
    expect(sink.records).toHaveLength(2);
    const statuses = sink.records.map((record) =>
      record.kind === "request" ? record.value.status : null,
    );
    expect(statuses).toEqual([201, 202]);
    expect(write).toHaveBeenCalledWith(expect.stringContaining('"event":"queue_discarded"'));
    await writer.close();
  });

  it("si la base falla, la petición ya terminó y el error se reporta como JSON", async () => {
    const writer = quietWriter(new FailingSink());
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    emitMonitorEvent({ event: "prueba", count: 1 });
    expect(write).toHaveBeenCalledWith(expect.stringContaining('"origin":"monitoring"'));

    writer.enqueue({
      kind: "request",
      value: {
        method: "GET",
        routePattern: "/api/v1/rooms",
        status: 200,
        durationMs: 1,
        isGood: 1,
        source: "real",
      },
    });
    await expect(writer.flush()).resolves.toBeUndefined();
    expect(write).toHaveBeenCalledWith(
      expect.stringContaining('"event":"monitor_write_failed"'),
    );
    await writer.close();
  });
});

describe("F1 · middleware global sin afectar respuestas", () => {
  it("registra una petición API con is_good y el SLI correcto", async () => {
    const sink = new CapturingSink();
    const writer = quietWriter(sink);
    const app = createApp({ monitorWriter: writer, checkDatabase: vi.fn() });

    const response = await app.request("/api/v1/no-existe");
    expect(response.status).toBe(404);
    await writer.flush();

    const record = sink.records.find((item) => item.kind === "request");
    expect(record?.kind).toBe("request");
    if (record?.kind === "request") {
      expect(record.value.sliId).toBe("T.3");
      expect(record.value.status).toBe(404);
      expect(record.value.isGood).toBe(1);
      expect(record.value.routePattern).toBe("/api/v1/no-existe");
    }
    await writer.close();
  });

  it("no registra health, ready ni el SSE", async () => {
    const sink = new CapturingSink();
    const writer = quietWriter(sink);
    const app = createApp({ monitorWriter: writer, checkDatabase: vi.fn() });

    await app.request("/health");
    await app.request("/ready");
    await app.request("/api/v1/messages/rooms/abc/events");
    await writer.close();

    expect(sink.records).toHaveLength(0);
  });

  it("marca el tráfico etiquetado como prueba sin leer datos personales", async () => {
    const sink = new CapturingSink();
    const writer = quietWriter(sink);
    const app = createApp({ monitorWriter: writer, checkDatabase: vi.fn() });

    await app.request("/api/v1/no-existe", {
      headers: { "x-roomlink-source": "test", "x-request-id": "not-a-uuid" },
    });
    await writer.flush();

    const record = sink.records.find((item) => item.kind === "request");
    expect(record?.kind).toBe("request");
    if (record?.kind === "request") {
      expect(record.value.source).toBe("test");
      expect(record.value.requestId).toMatch(/^[0-9a-f-]{36}$/i);
    }
    await writer.close();
  });

  it("registra excepciones en mon_error sin cambiar la respuesta", async () => {
    const sink = new CapturingSink();
    const writer = quietWriter(sink);
    const app = new Hono<{ Variables: AuthVariables }>();
    app.use("*", createRequestLogger(writer));
    app.get("/api/v1/boom", () => {
      throw new Error("fallo interno de prueba");
    });
    app.onError((_error, context) => context.text("error", 500));

    const response = await app.request("/api/v1/boom");
    expect(response.status).toBe(500);
    await writer.flush();

    const errors = sink.records.filter((item) => item.kind === "error");
    expect(errors.length).toBeGreaterThanOrEqual(1);
    // Hono convierte la excepción en 500 antes de que termine el middleware.
    expect(errors.some((item) => item.kind === "error" && item.value.code === "HTTP_500")).toBe(true);
    expect(errors.some((item) => item.kind === "error" && item.value.status === 500)).toBe(true);
    const serialized = JSON.stringify(sink.records);
    expect(serialized).not.toContain("fallo interno de prueba");
    await writer.close();
  });

  it("con la base de monitoreo caída la API responde igual", async () => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const writer = quietWriter(new FailingSink());
    const app = createApp({ monitorWriter: writer, checkDatabase: vi.fn() });

    const response = await app.request("/api/v1/no-existe");
    expect(response.status).toBe(404);
    await expect(writer.flush()).resolves.toBeUndefined();
    await writer.close();
  });
});
