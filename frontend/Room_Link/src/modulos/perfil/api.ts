
import AsyncStorage from '@react-native-async-storage/async-storage';

import { obtenerToken, obtenerUserId } from '@/auth/sesion';

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

// Fotografías que devuelve el backend.
export interface FotoPerfil {
  id: string;
  url: string;
  position: number;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  isMain: boolean;
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
  const userId = obtenerUserId();

  if (!baseUrl) {
    throw new Error(
      'Configura EXPO_PUBLIC_API_URL en frontend/Room_Link/.env.',
    );
  }

  if (!userId) {
    throw new Error('No hay una sesión activa. Inicia sesión para continuar.');
  }

  return { baseUrl, userId };
}

// Evita duplicar /api/v1 si ya está incluido en el .env.
function rutaApi(ruta: string) {
  const { baseUrl } = configuracionApi();
  const prefijo = baseUrl.endsWith('/api/v1')
    ? ''
    : '/api/v1';

  return `${prefijo}${ruta}`;
}

// Convierte la URL relativa de una fotografía en una URL absoluta.
export function obtenerUrlFoto(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  const { baseUrl } = configuracionApi();
  const servidor = baseUrl.replace(/\/api\/v1$/, '');

  return `${servidor}${url.startsWith('/') ? url : `/${url}`}`;
}

async function solicitud<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const { baseUrl } = configuracionApi();

  let response: Response;

  try {
    const token = obtenerToken();

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
    | (T & { error?: string })
    | null;

  if (!response.ok) {
    throw new Error(
      body?.error ?? `La API respondió con estado ${response.status}.`,
    );
  }

  if (body === null) {
    throw new Error('La API devolvió una respuesta vacía o inválida.');
  }

  return body;
}

// ==========================================
// PERFIL DEL USUARIO ACTUAL
// ==========================================

export function obtenerPerfil() {
  const { userId } = configuracionApi();
  return solicitud<PerfilPublico>(rutaApi(`/profiles/${encodeURIComponent(userId)}`));
}

// ==========================================
// PERFIL DE OTRO USUARIO
// ==========================================

export function obtenerPerfilPublicoPorId(userId: string) {
  if (!userId) {
    throw new Error('El ID del usuario es obligatorio.');
  }

  return solicitud<PerfilPublico>(
    rutaApi(`/profiles/${encodeURIComponent(userId)}`),
  );
}

// ==========================================
// FOTOGRAFÍAS DE OTRO USUARIO
// ==========================================

export async function obtenerFotosPerfil(userId: string) {
  if (!userId) {
    throw new Error('El ID del usuario es obligatorio.');
  }

  const respuesta = await solicitud<{
    items?: FotoPerfil[];
    photos?: FotoPerfil[];
  }>(
    rutaApi(`/profiles/${encodeURIComponent(userId)}/photos`),
  );

  return (respuesta.items ?? respuesta.photos ?? []).map((foto) => ({
    ...foto,
    url: obtenerUrlFoto(foto.url),
  }));
}

// ==========================================
// FOTO PRINCIPAL DE OTRO USUARIO
// ==========================================

export async function obtenerFotoPrincipal(userId: string) {
  const fotos = await obtenerFotosPerfil(userId);

  return fotos.find((foto) => foto.isMain) ?? fotos[0] ?? null;
}

// ==========================================
// ACTUALIZAR PERFIL PROPIO
// ==========================================

export function actualizarPerfil(datos: DatosPerfil) {
  const { userId } = configuracionApi();

  return solicitud<PerfilPublico>(
    rutaApi(`/profiles/${encodeURIComponent(userId)}`),
    {
      method: 'PUT',
      body: JSON.stringify(datos),
    },
  );
}

// ==========================================
// CONVERTIR PERFIL PARA EL FORMULARIO
// ==========================================

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

// ==========================================
// ALMACENAMIENTO LOCAL
// ==========================================

function clavePerfilLocal() {
  const userId = obtenerUserId() || 'local';
  return `@roomlink/profile:${userId}`;
}

function esPerfilFormulario(
  valor: unknown,
): valor is PerfilFormulario {
  if (
    typeof valor !== 'object' ||
    valor === null ||
    Array.isArray(valor)
  ) {
    return false;
  }

  const registro = valor as Record<string, unknown>;

  return CAMPOS_PERFIL.every(
    (campo) => typeof registro[campo] === 'string',
  );
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

export async function guardarPerfilLocal(
  perfil: PerfilFormulario,
): Promise<void> {
  await AsyncStorage.setItem(
    clavePerfilLocal(),
    JSON.stringify(perfil),
  );
}
