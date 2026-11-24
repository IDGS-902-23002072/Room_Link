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
    const url = await import("node:url");
    const path = await import("node:path");
    const dir = path.dirname(url.fileURLToPath(import.meta.url));
    const appJson = JSON.parse(
      fs.readFileSync(path.resolve(dir, "../Room_Link/app.json"), "utf8"),
    );
    const perms = appJson?.expo?.android?.permissions ?? [];
    expect(perms).toContain("android.permission.POST_NOTIFICATIONS");
    expect(perms).toContain("android.permission.VIBRATE");
    expect(perms).toContain("android.permission.RECEIVE_BOOT_COMPLETED");
  });
});

describe("mapa OpenStreetMap sin API key (Room_Link)", async () => {
  const {
    crearHtmlMapa,
    crearScriptActualizacion,
    interpretarMensajeMapa,
  } = await import("../Room_Link/src/modulos/anuncios/componentes/mapaOSM.logica");

  it("acepta solo toques con coordenadas válidas", () => {
    expect(
      interpretarMensajeMapa(JSON.stringify({ tipo: "toque", latitude: 21.12, longitude: -101.68 })),
    ).toEqual({ latitude: 21.12, longitude: -101.68 });
    expect(interpretarMensajeMapa("no es json")).toBeNull();
    expect(interpretarMensajeMapa(JSON.stringify({ tipo: "listo" }))).toBeNull();
    expect(interpretarMensajeMapa(JSON.stringify({ tipo: "toque", latitude: 95, longitude: 0 }))).toBeNull();
    expect(interpretarMensajeMapa(JSON.stringify({ tipo: "toque", latitude: "21", longitude: -101 }))).toBeNull();
    expect(interpretarMensajeMapa("null")).toBeNull();
  });

  it("genera un mapa con tiles de OpenStreetMap, atribución y sin claves de Google", () => {
    const html = crearHtmlMapa({ centro: { latitude: 21.1221, longitude: -101.68 }, marcador: null });
    expect(html).toContain("tile.openstreetmap.org");
    expect(html).toContain("OpenStreetMap");
    expect(html).toContain("21.1221");
    expect(html).not.toMatch(/googleapis|maps\.google|API_KEY/i);
  });

  it("serializa el estado en el script de actualización", () => {
    const script = crearScriptActualizacion({
      centro: { latitude: 1, longitude: 2 },
      marcador: { latitude: 3, longitude: 4 },
    });
    expect(script).toContain('"marcador":{"latitude":3,"longitude":4}');
    expect(script.trim().endsWith("true;")).toBe(true);
  });
});

describe("dependencias del mapa móvil (Room_Link)", () => {
  it("no depende de react-native-maps (Google Maps exige API key en Android)", async () => {
    const fs = await import("node:fs");
    const url = await import("node:url");
    const path = await import("node:path");
    const dir = path.dirname(url.fileURLToPath(import.meta.url));
    const pkg = JSON.parse(fs.readFileSync(path.resolve(dir, "../Room_Link/package.json"), "utf8"));
    expect(pkg.dependencies["react-native-maps"]).toBeUndefined();
    expect(pkg.dependencies["react-native-webview"]).toBeDefined();
    const pantalla = fs.readFileSync(
      path.resolve(dir, "../Room_Link/src/modulos/anuncios/PantallaUbicacion.tsx"),
      "utf8",
    );
    expect(pantalla).not.toContain("react-native-maps");
  });
});

describe("APIs sin sesión no tumban la app (Room_Link)", () => {
  // Bug real: estas funciones lanzaban de forma sincrónica cuando no había
  // sesión, así que el .catch() de las pantallas nunca se enganchaba y el
  // error escapaba del useEffect -> crash al abrir el APK.
  const casos = [
    ["compatibilidad", "obtenerTestCompatibilidad", []],
    ["compatibilidad", "guardarTestCompatibilidad", [{}]],
    ["compatibilidad", "obtenerFeedAfinidad", [1]],
    ["compatibilidad", "obtenerPerfilAfinidad", ["host-1"]],
    ["compatibilidad", "enviarSolicitudConexion", ["user-2"]],
    ["exploracion", "postularseAHabitacion", ["listing-1"]],
    ["perfil", "obtenerPerfil", []],
    ["perfil", "actualizarPerfil", [{}]],
    ["perfil", "actualizarInstagram", ["roomlink"]],
    ["perfil", "solicitarVerificacionIdentidad", []],
    ["acuerdos", "listarAcuerdosUsuario", []],
    ["acuerdos", "crearAcuerdoConvivencia", [{}]],
  ];

  it.each(casos)("%s.%s devuelve una promesa rechazada en lugar de lanzar", async (modulo, nombre, args) => {
    const api = await import(`../Room_Link/src/modulos/${modulo}/api.ts`);
    let resultado;
    expect(() => {
      resultado = api[nombre](...args);
    }).not.toThrow();
    expect(resultado).toBeInstanceOf(Promise);
    await expect(resultado).rejects.toThrow();
  });
});
