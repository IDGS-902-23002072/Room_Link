import { configuracionApi, solicitud } from '../compatibilidad/api';

export type EstadoHabitacion = 'draft' | 'published' | 'closed' | string;

/** Resumen de una habitación publicada (GET /api/v1/rooms). */
export interface HabitacionResumen {
  id: string;
  hostId: string;
  title: string;
  monthlyRent: number;
  status: EstadoHabitacion;
  photosCount: number;
  availableFrom: string | null;
  createdAt: string;
}

/** Detalle de una habitación (GET /api/v1/rooms/:id). */
export interface HabitacionDetalle extends HabitacionResumen {
  description: string | null;
  locationId: string | null;
  maxRoommates: number | null;
}

export interface PostulacionRespuesta {
  id: string;
  listingId: string;
  applicantId: string;
  status: string;
  message: string | null;
  compatibilityScore: number | null;
  createdAt: string;
  decidedAt: string | null;
}

export const TAMANO_PAGINA = 12;

export async function buscarHabitaciones(
  pagina: number,
  filtros: { texto: string; presupuestoMax?: number; disponibleYa: boolean },
  signal: AbortSignal,
) {
  const params = new URLSearchParams({
    page: String(pagina),
    pageSize: String(TAMANO_PAGINA),
    text: filtros.texto.trim(),
    availableNow: String(filtros.disponibleYa),
  });
  if (filtros.presupuestoMax !== undefined) params.set('budgetMax', String(filtros.presupuestoMax));
  const resultado = await solicitud<{
    items: (Omit<HabitacionDetalle, 'photosCount' | 'locationId'> & { photoCount: number })[];
    total: number;
    totalPages: number;
  }>(`/api/v1/search/listings?${params}`, { signal });
  return {
    ...resultado,
    items: resultado.items.map(({ photoCount, ...habitacion }) => ({
      ...habitacion, photosCount: photoCount, locationId: null,
    })),
  };
}

export function obtenerHabitacion(id: string) {
  return solicitud<HabitacionDetalle>(`/api/v1/rooms/${encodeURIComponent(id)}`);
}

/**
 * El buscador (usuario actual) se postula a una habitación publicada.
 * compatibilityScore es la afinidad entre el buscador y el anfitrión.
 */
export async function postularseAHabitacion(
  listingId: string,
  message: string | null = null,
  compatibilityScore: number | null = null,
) {
  const { userId } = configuracionApi();
  return solicitud<PostulacionRespuesta>('/api/v1/applications', {
    method: 'POST',
    body: JSON.stringify({
      listingId,
      applicantId: userId,
      message: message && message.trim().length > 0 ? message.trim() : null,
      compatibilityScore,
    }),
  });
}
