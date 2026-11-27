import { describe, expect, it } from "vitest";
import { opaqueCaseKey } from "../../src/monitoring/cases.js";
import { RESPONSE_HOURS, parseIncidentLabels } from "../../src/monitoring/incidents.js";

describe("F4 · casos medidos sin datos personales", () => {
  it("el identificador del caso es opaco, estable y no revela el id original", () => {
    const key = opaqueCaseKey(12345);
    expect(key).toHaveLength(36);
    expect(key).toBe(opaqueCaseKey(12345));
    expect(key).not.toContain("12345");
    expect(opaqueCaseKey(12346)).not.toBe(key);
  });
});

describe("F6 · incidentes de GitHub sin texto sensible", () => {
  it("lee prioridad y módulo de las etiquetas", () => {
    expect(parseIncidentLabels([{ name: "bug" }, "P0", { name: "M10" }])).toEqual({
      priority: "P0",
      module: "M10",
    });
  });

  it("usa P2 y PLAT por defecto cuando no hay etiquetas útiles", () => {
    expect(parseIncidentLabels([{ name: "se pide en correo: persona@correo.test" }])).toEqual({
      priority: "P2",
      module: "PLAT",
    });
  });

  it("los plazos de primera respuesta son los de la sección 9", () => {
    expect(RESPONSE_HOURS).toEqual({ P0: 4, P1: 9, P2: 18, P3: 45 });
  });
});
