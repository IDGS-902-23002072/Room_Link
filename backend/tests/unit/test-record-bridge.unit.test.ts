import { describe, expect, it, vi } from "vitest";
import {
  emitTestRecord,
  parseTestRecords,
  sanitizeTestRecord,
  TEST_RECORD_ENV,
} from "../../src/monitoring/testRecordBridge.js";
import type { MonitorRecord } from "../../src/monitoring/writer.js";

const requestId = "11111111-1111-4111-8111-111111111111";

describe("F4/F6 · puente seguro de registros de la suite", () => {
  it("lee solo las líneas marcadas y conserva la operación con su request_id", () => {
    const record: MonitorRecord = {
      kind: "activity",
      value: {
        module: "habitaciones",
        action: "Creación de anuncio",
        result: "success",
        message: "Se creó un anuncio de habitación en borrador.",
        httpStatus: 201,
        durationMs: 12,
        requestId,
        sliId: "7.1",
        actorId: null,
        source: "test",
        detail: { status: 201, route: "/api/v1/rooms" },
      },
    };
    const stdout = [
      "✓ tests/functional/functional-flows.test.ts (8 tests)",
      JSON.stringify({ origin: "monitoring", event: "batch_written", count: 2 }),
      JSON.stringify({ origin: "monitoring", event: "monitor_record", record }),
    ].join("\n");

    const parsed = parseTestRecords(stdout);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.kind).toBe("activity");
    if (parsed[0]?.kind === "activity") {
      expect(parsed[0].value.action).toBe("Creación de anuncio");
      expect(parsed[0].value.requestId).toBe(requestId);
      expect(parsed[0].value.source).toBe("test");
      expect(parsed[0].value.httpStatus).toBe(201);
    }
  });

  it("descarta texto sensible y rutas con ids concretos", () => {
    const withEmail = sanitizeTestRecord({
      kind: "activity",
      value: {
        module: "autenticación",
        action: "Inicio de sesión",
        result: "success",
        message: "Sesión de ana@roomlink.test",
        source: "real",
      },
    });
    expect(withEmail).toBeNull();

    const withId = sanitizeTestRecord({
      kind: "request",
      value: {
        method: "GET",
        routePattern: "/api/v1/rooms/123",
        status: 200,
        durationMs: 10,
        isGood: 1,
        source: "test",
      },
    });
    expect(withId).toBeNull();
  });

  it("fuerza source=test en los sondeos aunque el hijo diga otra cosa", () => {
    const parsed = sanitizeTestRecord({
      kind: "probe",
      value: {
        status: "up",
        httpStatus: 200,
        latencyMs: 5,
        requestId,
        source: "real",
        message: "El sondeo de /health fue correcto.",
        checkedAt: "2026-11-27T12:00:00.000Z",
      },
    });
    expect(parsed?.kind).toBe("probe");
    if (parsed?.kind === "probe") {
      expect(parsed.value.source).toBe("test");
      expect(parsed.value.status).toBe("up");
      expect(parsed.value.requestId).toBe(requestId);
      expect(parsed.value.checkedAt).toEqual(new Date("2026-11-27T12:00:00.000Z"));
    }
  });

  it("no escribe en stdout normal de pruebas salvo que se active la bandera", () => {
    const original = process.env[TEST_RECORD_ENV];
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const record: MonitorRecord = {
      kind: "probe",
      value: { status: "up", source: "test", message: "Sondeo correcto" },
    };

    emitTestRecord(record);
    expect(write).not.toHaveBeenCalled();

    process.env[TEST_RECORD_ENV] = "1";
    emitTestRecord(record);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0]?.[0]).toContain('"event":"monitor_record"');

    write.mockRestore();
    if (original === undefined) delete process.env[TEST_RECORD_ENV];
    else process.env[TEST_RECORD_ENV] = original;
  });
});
