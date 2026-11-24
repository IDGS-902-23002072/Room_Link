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
  instagram?: string | null;
  identityStatus: string;
  isVerified: boolean;
}

export interface DatosPerfil {
  fullName: string;
  occupation: string | null;
  bio: string | null;
  phone?: string | null;
}

export interface PerfilFormulario {
  nombre: string;
  edad: string;
  ocupacion: string;
  biografia: string;
  zona: string;
  presupuestoMin: string;
  presupuestoMax: string;
  ciudad?: string;
  telefono?: string;
  instagram?: string;
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
    throw new Error('Configura EXPO_PUBLIC_API_URL en frontend/Room_Link/.env.');
  }
  if (!userId) {
    throw new Error('No hay una sesión activa. Iniciá sesión para continuar.');
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
    if (response.status === 404 && body?.error?.startsWith('Perfil no encontrado')) {
      throw new PerfilNoEncontrado(body.error);
    }
    throw new Error(body?.error ?? `La API respondió con estado ${response.status}.`);
  }
  if (body === null) {
    throw new Error('La API devolvió una respuesta vacía o inválida.');
  }
  return body;
}

export class PerfilNoEncontrado extends Error {}

export async function obtenerPerfil() {
  const { userId } = configuracionApi();
  return solicitud<PerfilPublico>(rutaPerfil(userId));
}

export function crearPerfil(datos: DatosPerfil & { birthDate: string; instagram?: string }) {
  return solicitud<PerfilPublico>('/api/v1/profiles', {
    method: 'POST',
    body: JSON.stringify(datos),
  });
}

export async function actualizarPerfil(datos: DatosPerfil) {
  const { userId } = configuracionApi();
  return solicitud<PerfilPublico>(rutaPerfil(userId), {
    method: 'PUT',
    body: JSON.stringify(datos),
  });
}

export async function actualizarInstagram(instagram: string) {
  const { userId } = configuracionApi();
  return solicitud<PerfilPublico>(`${rutaPerfil(userId)}/socials`, {
    method: 'PUT',
    body: JSON.stringify({ instagram }),
  });
}

export async function solicitarVerificacionIdentidad() {
  const { userId } = configuracionApi();
  return solicitud<PerfilPublico>(`${rutaPerfil(userId)}/verification/request`, { method: 'POST' });
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
    telefono: perfil.phone ?? '',
    instagram: perfil.instagram ?? '',
  };
}

function clavePerfilLocal() {
  const userId = obtenerUserId() || 'local';
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
