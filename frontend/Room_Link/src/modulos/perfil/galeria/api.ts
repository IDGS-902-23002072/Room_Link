import AsyncStorage from '@react-native-async-storage/async-storage';

export const MAX_FOTOS = 6;
export const MAX_TAMANO_FOTO = 5 * 1024 * 1024;

export const TIPOS_FOTO_PERMITIDOS = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

/** Modelo que consumen las pantallas. */
export interface FotoPerfil {
  id: string;
  /** URL absoluta de la imagen servida por la API. */
  uri: string;
  nombre: string;
  tipo: string;
  tamano: number;
  agregadaEn: string;
}

/** DTO que devuelve el backend en /api/v1/profiles/:userId/photos. */
export interface FotoRemota {
  id: string;
  url: string;
  position: number;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  isMain: boolean;
}

/** Archivo listo para enviarse como multipart/form-data. */
export interface ArchivoSubida {
  /** Presente en web: el navegador puede leer el archivo comprimido. */
  file?: File;
  /** Presente en iOS/Android: URI local entregada por expo-image-picker. */
  uri?: string;
  name: string;
  type: string;
}

const CAMPOS_FOTO = [
  'id',
  'uri',
  'nombre',
  'tipo',
  'tamano',
  'agregadaEn',
] as const;

const TIPOS_POR_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

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

function claveGaleria(userId: string) {
  return `@roomlink/gallery:${userId}`;
}

function resolverUrl(baseUrl: string, url: string) {
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
}

function mapearFoto(baseUrl: string, foto: FotoRemota): FotoPerfil {
  return {
    id: foto.id,
    uri: resolverUrl(baseUrl, foto.url),
    nombre: foto.url.split('/').pop() ?? 'foto',
    tipo: foto.mimeType,
    tamano: foto.sizeBytes,
    agregadaEn: foto.createdAt,
  };
}

async function solicitud<T>(path: string, init?: RequestInit): Promise<T> {
  const { baseUrl } = configuracionApi();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, init);
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

function rutaFotos(userId: string) {
  return `/api/v1/profiles/${encodeURIComponent(userId)}/photos`;
}

/** Lee la galería desde el backend (fuente de verdad). */
export async function obtenerGaleria(): Promise<FotoPerfil[]> {
  const { userId, baseUrl } = configuracionApi();
  const data = await solicitud<{ photos: FotoRemota[] }>(rutaFotos(userId));
  return data.photos
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((foto) => mapearFoto(baseUrl, foto));
}

/** Sube una o varias fotos y devuelve la galería actualizada. */
export async function subirFotos(
  archivos: ArchivoSubida[],
): Promise<FotoPerfil[]> {
  if (archivos.length === 0) {
    throw new Error('Selecciona al menos una foto.');
  }

  const { userId, baseUrl } = configuracionApi();
  const formData = new FormData();

  for (const archivo of archivos) {
    if (archivo.file) {
      formData.append('photos', archivo.file);
    } else if (archivo.uri) {
      formData.append('photos', {
        uri: archivo.uri,
        name: archivo.name,
        type: archivo.type,
      } as unknown as Blob);
    }
  }

  const data = await solicitud<{ photos: FotoRemota[] }>(rutaFotos(userId), {
    method: 'POST',
    body: formData,
  });

  return data.photos
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((foto) => mapearFoto(baseUrl, foto));
}

/** Reordena la galería; la primera foto del arreglo queda como principal. */
export async function reordenarGaleria(
  photoIds: string[],
): Promise<FotoPerfil[]> {
  const { userId, baseUrl } = configuracionApi();
  const data = await solicitud<{ photos: FotoRemota[] }>(
    `${rutaFotos(userId)}/order`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoIds }),
    },
  );

  return data.photos
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((foto) => mapearFoto(baseUrl, foto));
}

/** Elimina una foto y devuelve la galería restante ya compactada. */
export async function eliminarFoto(id: string): Promise<FotoPerfil[]> {
  const { userId, baseUrl } = configuracionApi();
  const data = await solicitud<{ photos: FotoRemota[] }>(
    `${rutaFotos(userId)}/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );

  return data.photos
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((foto) => mapearFoto(baseUrl, foto));
}

export function normalizarTipoFoto(
  tipo?: string | null,
  nombre?: string | null,
): string | null {
  const tipoLimpio = tipo?.trim().toLowerCase();
  if (tipoLimpio === 'image/jpg') return 'image/jpeg';
  if (
    tipoLimpio &&
    (TIPOS_FOTO_PERMITIDOS as readonly string[]).includes(tipoLimpio)
  ) {
    return tipoLimpio;
  }

  const extension = nombre?.split('.').pop()?.trim().toLowerCase();
  if (!extension) return null;
  return TIPOS_POR_EXTENSION[extension] ?? null;
}

export function formatearTamano(tamano: number) {
  if (!Number.isFinite(tamano) || tamano <= 0) return 'Tamaño desconocido';
  if (tamano < 1024) return `${tamano} B`;
  if (tamano < 1024 * 1024) return `${Math.round(tamano / 1024)} KB`;
  return `${(tamano / (1024 * 1024)).toFixed(1)} MB`;
}

function esFotoPerfil(valor: unknown): valor is FotoPerfil {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
    return false;
  }

  const foto = valor as Record<string, unknown>;
  return CAMPOS_FOTO.every((campo) => campo in foto) &&
    typeof foto.id === 'string' &&
    typeof foto.uri === 'string' &&
    foto.uri.length > 0 &&
    typeof foto.nombre === 'string' &&
    typeof foto.tipo === 'string' &&
    typeof foto.tamano === 'number' &&
    Number.isFinite(foto.tamano) &&
    typeof foto.agregadaEn === 'string';
}

/**
 * Caché local de la galería. El backend es la fuente de verdad; esto solo
 * permite mostrar algo cuando no hay conexión.
 */
export async function leerGaleriaLocal(): Promise<FotoPerfil[]> {
  try {
    const userId = process.env.EXPO_PUBLIC_USER_ID?.trim() || 'local';
    const guardado = await AsyncStorage.getItem(claveGaleria(userId));
    if (!guardado) return [];

    const parseado: unknown = JSON.parse(guardado);
    if (!Array.isArray(parseado)) return [];

    return parseado.filter(esFotoPerfil).slice(0, MAX_FOTOS);
  } catch {
    return [];
  }
}

export async function guardarGaleriaLocal(
  fotos: FotoPerfil[],
): Promise<void> {
  try {
    const userId = process.env.EXPO_PUBLIC_USER_ID?.trim() || 'local';
    await AsyncStorage.setItem(
      claveGaleria(userId),
      JSON.stringify(fotos.slice(0, MAX_FOTOS)),
    );
  } catch {
    // El caché es opcional: si falla, la app sigue funcionando con la API.
  }
}
