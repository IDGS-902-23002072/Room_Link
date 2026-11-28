import { describe, expect, it } from "vitest";
import { ActivityLogEntry } from "../../src/domain/index.js";
import {
  ActivityLogConsumer,
  ActivityLogService,
  ActivityLogView,
  describeEvent,
  maskEmail,
  sanitizePayload,
} from "../../src/modules/activity-log/index.js";
import { InProcessEventBus } from "../../src/modules/notifications/event-bus.js";

describe("describeEvent", () => {
  it("redacta el inicio de sesión exitoso como operación exitosa de Autenticación", () => {
    const d = describeEvent("LoginSucceededEvent", {});
    expect(d.module).toBe("Autenticación");
    expect(d.outcome).toBe("success");
    expect(d.message).toContain("inició sesión correctamente");
  });

  it.each([
    ["user_not_found", "no existe una cuenta con ese correo"],
    ["invalid_password", "la contraseña no coincide"],
    ["locked", "bloqueada temporalmente"],
    ["inactive", "no está activa"],
  ])("explica el rechazo de inicio de sesión por %s", (reason, fragment) => {
    const d = describeEvent("LoginFailedEvent", { reason });
    expect(d.outcome).toBe("rejected");
    expect(d.message).toContain("Se rechazó el inicio de sesión");
    expect(d.message).toContain(fragment);
  });

  it("no inventa un motivo cuando el rechazo no está clasificado", () => {
    const d = describeEvent("LoginFailedEvent", { reason: "otra_cosa" });
    expect(d.message).toContain("motivo que el sistema no clasificó");
  });

  it("describe el estado de una postulación y de un anuncio moderado", () => {
    expect(describeEvent("ApplicationStatusChanged", { status: "accepted" }).message).toContain("aceptada");
    expect(describeEvent("ListingModeratedEvent", { status: "rejected", reason: "Fotos engañosas" }).message).toContain(
      "Fotos engañosas",
    );
  });

  it("describe cada tipo de sanción y un evento desconocido sin inventar detalles", () => {
    expect(describeEvent("SanctionIssuedEvent", { type: "temporary_suspension" }).message).toContain(
      "suspensión temporal",
    );
    const unknown = describeEvent("AlgoNuevoEvent", {});
    expect(unknown.module).toBe("Sistema");
    expect(unknown.message).toContain("AlgoNuevoEvent");
    expect(unknown.message).toContain("aún no tiene una descripción");
  });

  it("recorta un motivo muy largo para no desbordar la columna", () => {
    const message = describeEvent("ListingModeratedEvent", { status: "removed", reason: "x".repeat(600) }).message;
    expect(message.length).toBeLessThanOrEqual(500);
  });
});

describe("sanitizePayload y maskEmail", () => {
  it("enmascara el correo y valida su formato", () => {
    expect(maskEmail("ana.lopez@mail.com")).toBe("a***@mail.com");
    expect(maskEmail("sin-arroba")).toBeNull();
    expect(maskEmail("@mail.com")).toBeNull();
    expect(maskEmail(42)).toBeNull();
  });

  it("descarta correo completo, userAgent, IP y texto del mensaje", () => {
    const preview = "hola, mi teléfono es 477 000 0000";
    const clean = sanitizePayload({
      userId: "u1",
      email: "ana.lopez@mail.com",
      userAgent: "Mozilla/5.0",
      ipAddress: "9.9.9.9",
      preview,
      status: "pending",
    });
    expect(clean).toEqual({ userId: "u1", emailMasked: "a***@mail.com", previewLength: preview.length, status: "pending" });
    expect(JSON.stringify(clean)).not.toContain("ana.lopez");
    expect(JSON.stringify(clean)).not.toContain("teléfono");
  });
});

describe("ActivityLogConsumer con descripciones", () => {
  it("guarda mensaje, módulo, resultado y metadata sin datos sensibles", async () => {
    const entries: ActivityLogEntry[] = [];
    const service = new ActivityLogService({
      create: async (e) => (entries.push(e), e),
      list: async () => entries,
      count: async () => entries.length,
    });
    const bus = new InProcessEventBus({ publish: async () => {} });
    new ActivityLogConsumer(service).register(bus);

    await bus.publish({
      type: "LoginFailedEvent",
      aggregateId: "u1",
      payload: { userId: "u1", email: "ana.lopez@mail.com", reason: "invalid_password", ipAddress: "9.9.9.9", userAgent: "UA" },
    });

    const [entry] = entries;
    expect(entry?.module).toBe("Autenticación");
    expect(entry?.outcome).toBe("rejected");
    expect(entry?.description).toContain("la contraseña no coincide");
    expect(entry?.ipAddress).toBe("9.9.9.9");
    expect(entry?.metadata).toEqual({ userId: "u1", emailMasked: "a***@mail.com", reason: "invalid_password" });
  });
});

describe("ActivityLogView", () => {
  it("usa la descripción guardada cuando existe", () => {
    const dto = ActivityLogView.toDTO(
      new ActivityLogEntry({
        userId: null,
        action: "LoginSucceededEvent",
        metadata: {},
        ipAddress: null,
        createdAt: new Date("2026-11-26T00:00:00Z"),
        module: "Autenticación",
        outcome: "success",
        description: "Texto guardado.",
      }),
    );
    expect(dto.description).toBe("Texto guardado.");
  });

  it("redacta al leer los registros anteriores a la migración", () => {
    const dto = ActivityLogView.toDTO(
      new ActivityLogEntry({
        userId: "u1",
        action: "SanctionIssuedEvent",
        metadata: { type: "warning" },
        ipAddress: null,
        createdAt: new Date("2026-11-01T00:00:00Z"),
      }),
    );
    expect(dto.module).toBe("Moderación");
    expect(dto.outcome).toBe("success");
    expect(dto.description).toContain("una advertencia");
  });
});
