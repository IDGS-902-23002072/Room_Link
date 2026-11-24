import { afterEach, describe, expect, it, vi } from "vitest";
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

describe("búsqueda paginada de habitaciones (Room_Link)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("envía el texto y el presupuesto al feed y conserva el anfitrión y la zona", async () => {
    vi.stubEnv("EXPO_PUBLIC_API_URL", "https://roomlink.test");
    const item = {
      id: "room-13", hostId: "host-1", hostName: "Andrea", title: "Habitación en León",
      zone: "Centro", city: "León", monthlyRent: 2900, photosCount: 3, availableFrom: null,
    };
    const fetch = vi.fn(async () => Response.json({ items: [item], hasMore: true }));
    vi.stubGlobal("fetch", fetch);
    const { obtenerHabitacionesPublicadas } = await import("../Room_Link/src/modulos/exploracion/api");
    const { adaptarHabitacion } = await import("../Room_Link/src/modulos/exploracion/datos/habitaciones");
    const signal = new AbortController().signal;

    const resultado = await obtenerHabitacionesPublicadas(2, {
      texto: "León", presupuestoMax: 3000, disponibleYa: false,
    }, signal);

    const [ruta, opciones] = fetch.mock.calls[0];
    const { pathname, searchParams } = new URL(ruta);
    expect(pathname).toBe("/api/v1/rooms/feed");
    expect(Object.fromEntries(searchParams)).toEqual({ page: "2", pageSize: "12", q: "León", maxRent: "3000" });
    expect(opciones.signal).toBe(signal);
    expect(resultado.hayMas).toBe(true);
    expect(adaptarHabitacion(resultado.items[0])).toMatchObject({
      anfitrion: "Andrea", ubicacion: "Centro · León", fotos: 3,
    });
  });

  it("filtra la disponibilidad antes de paginar y adapta photoCount del buscador", async () => {
    vi.stubEnv("EXPO_PUBLIC_API_URL", "https://roomlink.test");
    const fetch = vi.fn(async () => Response.json({
      items: [{ id: "room-1", photoCount: 2 }], total: 1, totalPages: 1,
    }));
    vi.stubGlobal("fetch", fetch);
    const { obtenerHabitacionesPublicadas } = await import("../Room_Link/src/modulos/exploracion/api");

    const resultado = await obtenerHabitacionesPublicadas(1, {
      texto: "", disponibleYa: true,
    }, new AbortController().signal);

    const { pathname, searchParams } = new URL(fetch.mock.calls[0][0]);
    expect(pathname).toBe("/api/v1/search/listings");
    expect(searchParams.get("availableNow")).toBe("true");
    expect(resultado).toEqual({ items: [{ id: "room-1", photosCount: 2, locationId: null }], hayMas: false });
  });
});
