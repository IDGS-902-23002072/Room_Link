import { describe, expect, it } from "vitest";
import { normalizarHistorial, validarMensaje } from "../Room_Link/src/modulos/chats/logica";
import { esDenunciaDeAnuncio, validarDecisionModeracion } from "../Room_Link/src/modulos/moderacion/logica";

describe("reglas de mensajería unificada (Room_Link)", () => {
  it("normaliza texto válido y mantiene el orden cronológico por id", () => {
    expect(validarMensaje("  hola  ")).toEqual({ error: null, body: "hola" });
    expect(validarMensaje("   ").error).toBeTruthy();
    expect(
      normalizarHistorial([{ id: 3 }, { id: 1 }, { id: 2 }]).map(({ id }) => id),
    ).toEqual([1, 2, 3]);
  });
});

describe("reglas de moderación unificada (Room_Link)", () => {
  it("exige motivos para decisiones adversas y filtra denuncias de anuncios", () => {
    expect(validarDecisionModeracion("rejected", "")).toBeTruthy();
    expect(validarDecisionModeracion("removed", "fraude")).toBeNull();
    expect(validarDecisionModeracion("approved", "")).toBeNull();
    expect(esDenunciaDeAnuncio({ id: "1", listingId: "listing-1" })).toBe(true);
    expect(esDenunciaDeAnuncio({ id: "2", targetListingId: "listing-2" })).toBe(true);
    expect(esDenunciaDeAnuncio({ id: "3", targetUserId: "user-1" })).toBe(false);
  });
});

describe("permisos y configuración de notificaciones Android (Room_Link)", () => {
  it("declara POST_NOTIFICATIONS, VIBRATE y RECEIVE_BOOT_COMPLETED en app.json", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const appJson = JSON.parse(
      fs.readFileSync(path.resolve("Room_Link/app.json"), "utf8"),
    );
    const perms = appJson?.expo?.android?.permissions ?? [];
    expect(perms).toContain("android.permission.POST_NOTIFICATIONS");
    expect(perms).toContain("android.permission.VIBRATE");
    expect(perms).toContain("android.permission.RECEIVE_BOOT_COMPLETED");
  });
});
