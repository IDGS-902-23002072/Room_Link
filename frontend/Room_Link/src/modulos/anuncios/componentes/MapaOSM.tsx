import React, { useEffect, useMemo, useRef } from "react";
import { StyleProp, ViewStyle } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";

import {
  Coordenadas,
  crearHtmlMapa,
  crearScriptActualizacion,
  interpretarMensajeMapa,
} from "./mapaOSM.logica";

type Props = {
  centro: Coordenadas;
  marcador: Coordenadas | null;
  onToque: (punto: Coordenadas) => void;
  style?: StyleProp<ViewStyle>;
};

// Referer para la política de uso de tiles de OpenStreetMap.
const BASE_URL = "https://roomlink-prod-xdg80v.canadacentral.cloudapp.azure.com/";

/**
 * Mapa OpenStreetMap con Leaflet dentro de un WebView.
 * No requiere API key ni configuración nativa (a diferencia de Google Maps).
 */
export default function MapaOSM({ centro, marcador, onToque, style }: Props) {
  // WebView 14 declara la clase con P = undefined (props → never con React 19);
  // el genérico explícito `object` deja las props como WebViewProps.
  const webview = useRef<WebView<object>>(null);

  // El HTML se genera una sola vez; los cambios posteriores se inyectan
  // para no recargar la página (y los tiles) en cada render.
  const html = useMemo(
    () => crearHtmlMapa({ centro, marcador }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Dependencias primitivas: un objeto nuevo con las mismas coordenadas
  // no debe reinyectar el script.
  useEffect(() => {
    webview.current?.injectJavaScript(
      crearScriptActualizacion({ centro, marcador })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centro.latitude, centro.longitude, marcador?.latitude, marcador?.longitude]);

  const manejarMensaje = (evento: WebViewMessageEvent) => {
    const punto = interpretarMensajeMapa(evento.nativeEvent.data);
    if (punto) onToque(punto);
  };

  return (
    <WebView<object>
      ref={webview}
      style={style}
      originWhitelist={["*"]}
      source={{ html, baseUrl: BASE_URL }}
      onMessage={manejarMensaje}
      javaScriptEnabled
      domStorageEnabled
      setSupportMultipleWindows={false}
    />
  );
}
