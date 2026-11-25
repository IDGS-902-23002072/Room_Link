
import { obtenerToken } from "../../auth/sesion";

// ==========================================
// CONFIGURACIÓN
// ==========================================

const API_URL = process.env.EXPO_PUBLIC_API_URL
  ?.trim()
  .replace(/\/+$/, "");

if (!API_URL) {
  console.warn("No está configurada EXPO_PUBLIC_API_URL.");
}

// ==========================================
// TIPOS
// ==========================================

export type DireccionConexion = "incoming" | "outgoing" | "all";

export type EstadoConexion =
  | "pending"
  | "accepted"
  | "rejected"
  | "cancelled";

export interface ConexionDto {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: EstadoConexion;
  introMessage: string | null;
  responseMessage: string | null;
  createdAt: string;
  respondedAt: string | null;
}

// ==========================================
// FUNCIÓN GENERAL DE PETICIONES
// ==========================================

async function solicitud<T>(
  ruta: string,
  opciones: RequestInit = {},
): Promise<T> {

  const token = obtenerToken();

  if (!token) {
    throw new Error("No hay una sesión activa.");
  }

  if (!API_URL) {
    throw new Error("No está configurada EXPO_PUBLIC_API_URL.");
  }

  let respuesta: Response;

  try {
    respuesta = await fetch(`${API_URL}${ruta}`, {
      ...opciones,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...opciones.headers,
      },
    });
  } catch (error) {
    throw new Error(
      `No se pudo conectar con Room_Link: ${
        error instanceof Error ? error.message : "Error de red"
      }`,
    );
  }

  const resultado = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    throw new Error(
      resultado?.error ?? `Error HTTP ${respuesta.status}`,
    );
  }

  if (resultado === null) {
    throw new Error("La API devolvió una respuesta vacía o inválida.");
  }

  return resultado as T;
}

// ==========================================
// LISTAR CONEXIONES
// ==========================================

export function listarConexiones(
  direction: DireccionConexion = "all",
): Promise<ConexionDto[]> {
  return solicitud<ConexionDto[]>(
    `/api/v1/connections?direction=${encodeURIComponent(direction)}`,
  );
}

// ==========================================
// ENVIAR SOLICITUD
// ==========================================

export function enviarConexion(
  addresseeId: string,
  introMessage: string | null = null,
): Promise<ConexionDto> {
  return solicitud<ConexionDto>(
    "/api/v1/connections",
    {
      method: "POST",
      body: JSON.stringify({ addresseeId, introMessage }),
    },
  );
}

// ==========================================
// ACEPTAR O RECHAZAR
// ==========================================

export function responderConexion(
  connectionId: string,
  decision: "accept" | "reject",
  responseMessage: string | null = null,
): Promise<ConexionDto> {
  return solicitud<ConexionDto>(
    `/api/v1/connections/${encodeURIComponent(connectionId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ decision, responseMessage }),
    },
  );
}

// ==========================================
// CANCELAR SOLICITUD
// ==========================================

export function cancelarConexion(
  connectionId: string,
): Promise<ConexionDto> {
  return solicitud<ConexionDto>(
    `/api/v1/connections/${encodeURIComponent(connectionId)}`,
    { method: "DELETE" },
  );
}
