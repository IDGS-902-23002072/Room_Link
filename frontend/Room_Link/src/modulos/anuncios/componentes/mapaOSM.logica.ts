// Lógica pura del mapa OpenStreetMap (Leaflet dentro de un WebView).
// Sin dependencias de React Native para poder probarla con vitest.
// OpenStreetMap no requiere API key; exige mostrar la atribución.

export type Coordenadas = {
  latitude: number;
  longitude: number;
};

export type EstadoMapa = {
  centro: Coordenadas;
  marcador: Coordenadas | null;
};

export const ZOOM_INICIAL = 15;

const LEAFLET_VERSION = "1.9.4";
const LEAFLET_CSS = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`;
const LEAFLET_JS = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`;

export const esCoordenadaValida = (valor: unknown): valor is Coordenadas => {
  if (typeof valor !== "object" || valor === null) return false;
  const { latitude, longitude } = valor as Record<string, unknown>;
  return (
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
  );
};

/**
 * Interpreta un mensaje enviado por la página del mapa.
 * Solo acepta `{ tipo: "toque", latitude, longitude }`; cualquier otra cosa
 * (JSON inválido, tipo desconocido, coordenadas fuera de rango) devuelve null.
 */
export const interpretarMensajeMapa = (data: string): Coordenadas | null => {
  let mensaje: unknown;
  try {
    mensaje = JSON.parse(data);
  } catch {
    return null;
  }
  if (typeof mensaje !== "object" || mensaje === null) return null;
  if ((mensaje as { tipo?: unknown }).tipo !== "toque") return null;
  if (!esCoordenadaValida(mensaje)) return null;
  return { latitude: mensaje.latitude, longitude: mensaje.longitude };
};

/** Script que aplica un nuevo estado (centro + marcador) en la página. */
export const crearScriptActualizacion = (estado: EstadoMapa): string =>
  `window.actualizarMapa && window.actualizarMapa(${JSON.stringify(estado)}); true;`;

/** Documento HTML autocontenido con Leaflet y tiles de OpenStreetMap. */
export const crearHtmlMapa = (estado: EstadoMapa, zoom = ZOOM_INICIAL): string => `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="${LEAFLET_CSS}" />
<style>html,body,#mapa{height:100%;margin:0;padding:0;background:#EDE5EE}</style>
</head>
<body>
<div id="mapa"></div>
<script src="${LEAFLET_JS}"></script>
<script>
(function () {
  var enviar = function (msg) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  };
  if (!window.L) { enviar({ tipo: "error", motivo: "leaflet" }); return; }
  var inicial = ${JSON.stringify(estado)};
  var mapa = L.map("mapa", { zoomControl: true, attributionControl: true })
    .setView([inicial.centro.latitude, inicial.centro.longitude], ${zoom});
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap"
  }).addTo(mapa);
  var marcador = null;
  window.actualizarMapa = function (estado) {
    mapa.panTo([estado.centro.latitude, estado.centro.longitude]);
    if (estado.marcador) {
      var punto = [estado.marcador.latitude, estado.marcador.longitude];
      if (marcador) marcador.setLatLng(punto); else marcador = L.marker(punto).addTo(mapa);
    } else if (marcador) {
      mapa.removeLayer(marcador);
      marcador = null;
    }
  };
  window.actualizarMapa(inicial);
  mapa.on("click", function (e) {
    enviar({ tipo: "toque", latitude: e.latlng.lat, longitude: e.latlng.lng });
  });
  enviar({ tipo: "listo" });
})();
</script>
</body>
</html>`;
