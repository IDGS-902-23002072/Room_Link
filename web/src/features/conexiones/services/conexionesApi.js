
import { apiRequest } from "../../../services/api.js";

const CONNECTIONS_URL = "/api/v1/connections";
const PROFILES_URL = "/api/v1/profiles";

// Consultar solicitudes recibidas, enviadas o todas.
export async function obtenerConexiones(token, direction = "all") {
  const params = new URLSearchParams({ direction });

  const conexiones = await apiRequest(
    `${CONNECTIONS_URL}?${params.toString()}`,
    {
      token,
      method: "GET",
    }
  );

  if (!Array.isArray(conexiones)) {
    throw new Error("La API devolvió una lista de conexiones inválida.");
  }

  return conexiones;
}

// Consultar información pública de un usuario.
export function obtenerPerfil(token, userId) {
  return apiRequest(
    `${PROFILES_URL}/${encodeURIComponent(userId)}`,
    {
      token,
      method: "GET",
    }
  );
}

// Consultar fotografías de un usuario.
export function obtenerFotosPerfil(token, userId) {
  return apiRequest(
    `${PROFILES_URL}/${encodeURIComponent(userId)}/photos`,
    {
      token,
      method: "GET",
    }
  );
}

// Aceptar o rechazar una solicitud.
export function responderConexion(
  token,
  connectionId,
  decision,
  responseMessage = null
) {
  return apiRequest(
    `${CONNECTIONS_URL}/${encodeURIComponent(connectionId)}`,
    {
      token,
      method: "PATCH",
      body: JSON.stringify({
        decision,
        responseMessage,
      }),
    }
  );
}

// Cancelar una solicitud enviada.
export function cancelarConexion(token, connectionId) {
  return apiRequest(
    `${CONNECTIONS_URL}/${encodeURIComponent(connectionId)}`,
    {
      token,
      method: "DELETE",
    }
  );
}

// Enviar una solicitud de conexión.
export function enviarConexion(token, addresseeId, introMessage = null) {
  return apiRequest(CONNECTIONS_URL, {
    token,
    method: "POST",
    body: JSON.stringify({
      addresseeId,
      introMessage,
    }),
  });
}

export function abrirSalaChat(token, connectionId) {
  return apiRequest("/api/v1/messages/rooms", {
    token,
    method: "POST",
    body: JSON.stringify({ connectionId }),
  });
}
