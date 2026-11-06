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

function configuracionApi() {
  const baseUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '');
  const userId = process.env.EXPO_PUBLIC_USER_ID?.trim();

  if (!baseUrl || !userId) {
    throw new Error(
      'Configura EXPO_PUBLIC_API_URL y EXPO_PUBLIC_USER_ID en frontend/Room_Link/.env.',
    );
  }

  return { baseUrl, userId };
}

async function solicitud<T>(path: string, init?: RequestInit): Promise<T> {
  const { baseUrl } = configuracionApi();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
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
    | (T & { error?: string })
    | null;
  if (!response.ok) {
    throw new Error(body?.error ?? `La API respondió con estado ${response.status}.`);
  }
  if (body === null) {
    throw new Error('La API devolvió una respuesta vacía o inválida.');
  }
  return body;
}

function rutaUsuario(userId: string, suffix = '') {
  return `/api/v1/compatibility/${encodeURIComponent(userId)}${suffix}`;
}

export function obtenerTestCompatibilidad() {
  const { userId } = configuracionApi();
  return solicitud<ResultadoTest>(rutaUsuario(userId));
}

export function guardarTestCompatibilidad(answers: RespuestasCompatibilidad) {
  const { userId } = configuracionApi();
  return solicitud<ResultadoTest>(rutaUsuario(userId), {
    method: 'PUT',
    body: JSON.stringify(answers),
  });
}

export function obtenerFeedAfinidad(page: number) {
  const { userId } = configuracionApi();
  return solicitud<FeedAfinidad>(
    `${rutaUsuario(userId, '/feed')}?page=${page}`,
  );
}

export function obtenerPerfilAfinidad(candidateId: string) {
  const { userId } = configuracionApi();
  return solicitud<PerfilAfinidad>(
    rutaUsuario(userId, `/candidates/${encodeURIComponent(candidateId)}`),
  );
}

export function enviarSolicitudConexion(
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
