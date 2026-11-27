import { describe, expect, it } from "vitest";
import { addBusinessHours, monthWindow } from "../../src/monitoring/time.js";

describe("Meses en UTC-6", () => {
  it("diciembre empieza el 1 a las 00:00 local y termina el 1 de enero", () => {
    expect(monthWindow("2026-12").start.toISOString()).toBe("2026-12-01T06:00:00.000Z");
    expect(monthWindow("2026-12").end.toISOString()).toBe("2027-01-01T06:00:00.000Z");
  });

  it("la ventana de 3 meses incluye el mes actual y los dos anteriores", () => {
    const window = monthWindow("2026-01", 3);
    expect(window.start.toISOString()).toBe("2025-11-01T06:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-02-01T06:00:00.000Z");
  });

  it("rechaza un periodo mal escrito", () => {
    expect(() => monthWindow("2026-13")).toThrow("Periodo inválido");
    expect(() => monthWindow(" diciembre ")).toThrow("Periodo inválido");
  });
});

describe("Plazos de primera respuesta (sección 9 del SLA)", () => {
  it("P0 son 4 horas dentro del horario de soporte", () => {
    const opened = new Date("2026-11-27T16:00:00.000Z"); // viernes 10:00 local
    expect(addBusinessHours(opened, 4).toISOString()).toBe("2026-11-27T20:00:00.000Z");
  });

  it("un plazo que pasa las 18:00 continúa el siguiente día hábil", () => {
    const opened = new Date("2026-11-27T23:00:00.000Z"); // viernes 17:00 local
    expect(addBusinessHours(opened, 2).toISOString()).toBe("2026-11-30T16:00:00.000Z");
  });

  it("P3 son 45 horas hábiles y saltan el fin de semana", () => {
    const opened = new Date("2026-11-27T16:00:00.000Z"); // viernes 10:00 local
    expect(addBusinessHours(opened, 45).toISOString()).toBe("2026-12-04T16:00:00.000Z");
  });

  it("un incidente abierto fuera de horario empieza a contar a las 9:00", () => {
    const opened = new Date("2026-11-28T03:00:00.000Z"); // sábado 21:00 local
    expect(addBusinessHours(opened, 1).toISOString()).toBe("2026-11-30T16:00:00.000Z");
  });
});
