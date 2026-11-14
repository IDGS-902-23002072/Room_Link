// API de habitaciones para quien busca cuarto (HU-04): feed y postulación.

export type HabitacionFeed = {
  id: string;
  hostId: string;
  hostName: string | null;
  title: string;
  description: string | null;
  monthlyRent: number;
  availableFrom: string | null;
  maxRoommates: number | null;
  photosCount: number;
  address: string | null;
  zone: string | null;
  city: string | null;
  publishedAt: string | null;
};

export type FeedHabitaciones = {
  page: number;
  pageSize: number;
  hasMore: boolean;
  items: HabitacionFeed[];
};

export type FiltrosFeed = {
  busqueda?: string;
  rentaMinima?: number;
  rentaMaxima?: number;
};

export type FotoHabitacion = {
  id: string;
  fileName: string;
  mimeType: string;
  position: number;
};

export type DetalleHabitacion = {
  id: string;
  hostId: string;
  title: string;
  description: string | null;
  monthlyRent: number;
  availableFrom: string | null;
  maxRoommates: number | null;
  location: { address: string; latitude: number; longitude: number } | null;
  photos: FotoHabitacion[];
};

export type Postulacion = {
  id: string;
  listingId: string;
  status: string;
};

function baseApi(): string {
  const raiz = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '');
  if (!raiz) {
    throw new Error('Configura EXPO_PUBLIC_API_URL en frontend/Room_Link/.env.');
  }
  // Acepta la URL con o sin el prefijo /api/v1.
  return raiz.endsWith('/api/v1') ? raiz : `${raiz}/api/v1`;
}

async function solicitud<T>(ruta: string, init?: RequestInit): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(`${baseApi()}${ruta}`, {
      ...init,
      headers: { Accept: 'application/json', ...init?.headers },
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Configura')) throw error;
    throw new Error('No se pudo conectar con el servidor. Revisa tu conexión.');
  }

  const cuerpo = (await respuesta.json().catch(() => null)) as
    | (T & { error?: string })
    | null;

  if (!respuesta.ok) {
    throw new Error(cuerpo?.error ?? `El servidor respondió con estado ${respuesta.status}.`);
  }
  if (cuerpo === null) {
    throw new Error('El servidor devolvió una respuesta vacía.');
  }
  return cuerpo;
}

export function obtenerFeedHabitaciones(pagina: number, filtros: FiltrosFeed = {}) {
  const parametros = new URLSearchParams({ page: String(pagina), pageSize: '10' });
  if (filtros.busqueda?.trim()) parametros.set('q', filtros.busqueda.trim());
  if (filtros.rentaMinima !== undefined) parametros.set('minRent', String(filtros.rentaMinima));
  if (filtros.rentaMaxima !== undefined) parametros.set('maxRent', String(filtros.rentaMaxima));

  // No mostrar las habitaciones que publicó el mismo usuario.
  const usuario = process.env.EXPO_PUBLIC_USER_ID?.trim();
  if (usuario) parametros.set('excludeHostId', usuario);

  return solicitud<FeedHabitaciones>(`/rooms/feed?${parametros.toString()}`);
}

export function obtenerDetalleHabitacion(id: string) {
  return solicitud<DetalleHabitacion>(`/rooms/${encodeURIComponent(id)}`);
}

export function urlFotoPortada(id: string): string {
  return `${baseApi()}/rooms/${encodeURIComponent(id)}/photos/first`;
}

export function urlFotoHabitacion(id: string, fotoId: string): string {
  return `${baseApi()}/rooms/${encodeURIComponent(id)}/photos/${encodeURIComponent(fotoId)}`;
}

export function postularseAHabitacion(listingId: string, mensaje: string) {
  const token = process.env.EXPO_PUBLIC_AUTH_TOKEN?.trim();
  if (!token) {
    return Promise.reject(new Error('Inicia sesión para postularte a una habitación.'));
  }

  return solicitud<Postulacion>('/applications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ listingId, message: mensaje.trim() || null }),
  });
}
