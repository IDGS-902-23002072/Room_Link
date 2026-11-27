import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { BatchedMonitorWriter, type MonitorRecord, type MonitorSink } from "../../src/monitoring/writer.js";
import { safeText } from "../../src/modules/monitoring/index.js";

const TOKEN = "token-de-ingesta-de-prueba";

class CapturingSink implements MonitorSink {
  readonly records: MonitorRecord[] = [];
  async insert(records: MonitorRecord[]): Promise<void> {
    this.records.push(...records);
  }
}

function setup() {
  const sink = new CapturingSink();
  const writer = new BatchedMonitorWriter(sink, { batchSize: 100, intervalMs: 600_000 });
  const app = createApp({
    monitorWriter: writer,
    monitorIngestToken: TOKEN,
    checkDatabase: vi.fn(),
  });
  return { app, sink, writer };
}

const headers = {
  "content-type": "application/json",
  "x-monitor-token": TOKEN,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("F2/F3/F5 · ingesta protegida", () => {
  it("rechaza cualquier petición sin token de servicio", async () => {
    const { app, sink, writer } = setup();

    const response = await app.request("/api/v1/admin/monitoring/ingest/probe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "up" }),
    });

    expect(response.status).toBe(401);
    await writer.close();
    expect(sink.records.some((record) => record.kind === "probe")).toBe(false);
  });

  it("registra un sondeo como sintético con mensaje descriptivo", async () => {
    const { app, sink, writer } = setup();

    const response = await app.request("/api/v1/admin/monitoring/ingest/probe", {
      method: "POST",
      headers,
      body: JSON.stringify({
        status: "up",
        httpStatus: 200,
        latencyMs: 35,
        checkedAt: "2026-11-27T12:00:00.000Z",
      }),
    });
    expect(response.status).toBe(202);
    await writer.flush();

    const probe = sink.records.find((record) => record.kind === "probe");
    expect(probe?.kind).toBe("probe");
    if (probe?.kind === "probe") {
      expect(probe.value.source).toBe("synthetic");
      expect(probe.value.status).toBe("up");
      expect(probe.value.latencyMs).toBe(35);
      expect(probe.value.message).toContain("/ready");
    }
    await writer.close();
  });

  it("rechaza un respaldo con fecha inválida", async () => {
    const { app, writer } = setup();

    const response = await app.request("/api/v1/admin/monitoring/ingest/backup", {
      method: "POST",
      headers,
      body: JSON.stringify({ backupDate: "27/11/2026", status: "success" }),
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe("BACKUP_INVALID");
    await writer.close();
  });

  it("registra una corrida completa y separa sensible de los resultados", async () => {
    const { app, sink, writer } = setup();
    const id = randomUUID();

    const response = await app.request("/api/v1/admin/monitoring/ingest/test-run", {
      method: "POST",
      headers,
      body: JSON.stringify({
        run: {
          id,
          startedAt: "2026-11-27T12:00:00.000Z",
          finishedAt: "2026-11-27T12:00:05.000Z",
          suite: "backend:unit",
          complete: true,
          totalTests: 199,
          passedTests: 199,
          failedTests: 0,
          commitSha: "abc123",
        },
        results: [
          {
            sliId: "1.5",
            module: "M1 · Autenticación",
            testName: "[SLI 1.5] registro con contraseña válida",
            result: "passed",
            dataSummary: "correo qa@roomlink.test y token abcdefghijklmnopqrstuvwxyz",
            expected: "201",
            obtained: "201",
            durationMs: 12,
          },
        ],
      }),
    });

    expect(response.status).toBe(202);
    await writer.flush();

    const run = sink.records.find((record) => record.kind === "testRun");
    expect(run?.kind).toBe("testRun");
    if (run?.kind === "testRun") {
      expect(run.value.source).toBe("test");
      expect(run.value.complete).toBe(1);
      expect(run.value.message).toContain("completa");
    }

    const result = sink.records.find((record) => record.kind === "testResult");
    expect(result?.kind).toBe("testResult");
    if (result?.kind === "testResult") {
      expect(result.value.sliId).toBe("1.5");
      expect(result.value.dataSummary).toBeNull();
      expect(result.value.source).toBe("test");
      expect(JSON.stringify(result.value)).not.toContain("qa@roomlink.test");
      expect(JSON.stringify(result.value)).not.toContain("abcdefghijklmnopqrstuvwxyz");
    }
    await writer.close();
  });

  it("limpia texto sensible antes de guardarlo", () => {
    expect(safeText("usuario@correo.test")).toBeNull();
    expect(safeText("Bearer abc.def.ghi")).toBeNull();
    expect(safeText("/api/v1/rooms/123")).toBeNull();
    expect(safeText("El usuario se registró correctamente")).toBe(
      "El usuario se registró correctamente",
    );
  });

  it("rechaza un cuerpo mayor al límite configurado", async () => {
    const { app, writer } = setup();
    const large = JSON.stringify({ status: "up", padding: "x".repeat(300_000) });

    const response = await app.request("/api/v1/admin/monitoring/ingest/probe", {
      method: "POST",
      headers,
      body: large,
    });

    expect(response.status).toBe(413);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe("INGEST_TOO_LARGE");
    await writer.close();
  });
});
