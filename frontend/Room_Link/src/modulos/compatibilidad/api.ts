import { obtenerToken, obtenerUserId } from '../../auth/sesion';

export type DimensionCompatibilidad =
  | 'schedule'
  | 'cleanliness'
  | 'noise'
  | 'pets'
  | 'smoking'
  | 'visits'
  | 'genderPref';

export type RespuestasCompatibilidad = Record<DimensionCompatibilidad, number>;

export interface ResumenDimension {
  dimension: DimensionCompatibilidad;
  percentage: number;
  level: 'bajo' | 'medio' | 'alto';
}

export interface ResultadoTest {
  completed: boolean;
  answers: RespuestasCompatibilidad | null;
  summary: ResumenDimension[];
  updatedAt: string | null;
}

export interface PerfilAfinidad {
  userId: string;
  fullName: string;
  age: number;
  city: string | null;
  zone: string | null;
  budgetMin: string | null;
  budgetMax: string | null;
  photoUrl: string | null;
  bio: string | null;
  occupation: string | null;
  compatibilityScore: number | null;
  compatibilitySummary: ResumenDimension[] | null;
}

export interface FeedAfinidad {
  hasTest: boolean;
  page: number;
  pageSize: number;
  hasMore: boolean;
  profiles: PerfilAfinidad[];
}

/** URL base de la API (desde el entorno). No requiere sesión. */
function urlBase(): string {
  const baseUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '');
  if (!baseUrl) {
    throw new Error('Configura EXPO_PUBLIC_API_URL en frontend/Room_Link/.env.');
  }
  return baseUrl;
}

/**
 * Config que requiere sesión: devuelve el userId del usuario autenticado
 * (ya NO un UUID hardcodeado del .env). El backend valida el token (RNF-01.2).
 */
export function configuracionApi() {
  const userId = obtenerUserId();
  if (!userId) {
    throw new Error('No hay una sesión activa. Iniciá sesión para continuar.');
  }
  return { baseUrl: urlBase(), userId };
}

export async function solicitud<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = urlBase();
  const token = obtenerToken();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });
  } catch (error) {
    throw new Error(
      `No se pudo conectar con RoomLink API: ${
        error instanceof Error ? error.message : 'error de red'
      }`,
    );
  }

  const body = (await response.json().catch(() => null)) as
    | (T & { error?: string; code?: string })
    | null;
  if (!response.ok) {
    if (response.status >= 500 && !body?.code?.startsWith("GEOLOCATION_")) {
      throw new Error(
        `La API respondió con un error interno (${response.status}). Comprueba que MySQL esté iniciado y que /ready responda con estado "ready".`,
      );
    }
    throw Object.assign(new Error(body?.error ?? `La API respondió con estado ${response.status}.`), {
      code: body?.code,
    });
  }
  if (body === null) {
    throw new Error('La API devolvió una respuesta vacía o inválida.');
  }
  return body;
}

function rutaUsuario(userId: string, suffix = '') {
  return `/api/v1/compatibility/${encodeURIComponent(userId)}${suffix}`;
}

export async function obtenerTestCompatibilidad() {
  const { userId } = configuracionApi();
  return solicitud<ResultadoTest>(rutaUsuario(userId));
}

export async function guardarTestCompatibilidad(answers: RespuestasCompatibilidad) {
  const { userId } = configuracionApi();
  return solicitud<ResultadoTest>(rutaUsuario(userId), {
    method: 'PUT',
    body: JSON.stringify(answers),
  });
}

export async function obtenerFeedAfinidad(page: number) {
  const { userId } = configuracionApi();
  return solicitud<FeedAfinidad>(
    `${rutaUsuario(userId, '/feed')}?page=${page}`,
  );
}

export async function obtenerPerfilAfinidad(candidateId: string) {
  const { userId } = configuracionApi();
  return solicitud<PerfilAfinidad>(
    rutaUsuario(userId, `/candidates/${encodeURIComponent(candidateId)}`),
  );
}

export async function enviarSolicitudConexion(
  candidateId: string,
  introMessage: string | null = null,
) {
  const { userId } = configuracionApi();
  return solicitud<{
    id: string;
    requesterId: string;
    addresseeId: string;
    status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
    createdAt: string;
  }>(rutaUsuario(userId, '/connections'), {
    method: 'POST',
    body: JSON.stringify({ candidateId, introMessage }),
  });
}
