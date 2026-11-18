import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PerfilPublico {
  userId: string;
  fullName: string;
  birthDate: string;
  age: number;
  occupation: string | null;
  bio: string | null;
  phone: string | null;
  identityStatus: string;
  isVerified: boolean;
}

export interface DatosPerfil {
  fullName: string;
  occupation: string | null;
  bio: string | null;
}

export interface PerfilFormulario {
  nombre: string;
  edad: string;
  ocupacion: string;
  biografia: string;
  zona: string;
  presupuestoMin: string;
  presupuestoMax: string;
}

const CAMPOS_PERFIL: (keyof PerfilFormulario)[] = [
  'nombre',
  'edad',
  'ocupacion',
  'biografia',
  'zona',
  'presupuestoMin',
  'presupuestoMax',
];

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

function rutaPerfil(userId: string) {
  return `/api/v1/profiles/${encodeURIComponent(userId)}`;
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

export function obtenerPerfil() {
  const { userId } = configuracionApi();
  return solicitud<PerfilPublico>(rutaPerfil(userId));
}

export function actualizarPerfil(datos: DatosPerfil) {
  const { userId } = configuracionApi();
  return solicitud<PerfilPublico>(rutaPerfil(userId), {
    method: 'PUT',
    body: JSON.stringify(datos),
  });
}

export function perfilDesdeApi(perfil: PerfilPublico): PerfilFormulario {
  return {
    nombre: perfil.fullName,
    edad: String(perfil.age),
    ocupacion: perfil.occupation ?? '',
    biografia: perfil.bio ?? '',
    zona: '',
    presupuestoMin: '',
    presupuestoMax: '',
  };
}

function clavePerfilLocal() {
  const userId = process.env.EXPO_PUBLIC_USER_ID?.trim() || 'local';
  return `@roomlink/profile:${userId}`;
}

function esPerfilFormulario(valor: unknown): valor is PerfilFormulario {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
    return false;
  }
  const registro = valor as Record<string, unknown>;
  return CAMPOS_PERFIL.every((campo) => typeof registro[campo] === 'string');
}

export async function leerPerfilLocal(): Promise<PerfilFormulario | null> {
  try {
    const guardado = await AsyncStorage.getItem(clavePerfilLocal());
    if (!guardado) return null;
    const parseado: unknown = JSON.parse(guardado);
    return esPerfilFormulario(parseado) ? parseado : null;
  } catch {
    return null;
  }
}

export async function guardarPerfilLocal(perfil: PerfilFormulario): Promise<void> {
  await AsyncStorage.setItem(clavePerfilLocal(), JSON.stringify(perfil));
}
