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

/** Feed paginado de habitaciones publicadas (limit/offset). */
export function obtenerHabitacionesPublicadas(pagina: number) {
  const offset = (pagina - 1) * TAMANO_PAGINA;
  return solicitud<HabitacionResumen[]>(
    `/api/v1/rooms?limit=${TAMANO_PAGINA}&offset=${offset}`,
  );
}

export function obtenerHabitacion(id: string) {
  return solicitud<HabitacionDetalle>(`/api/v1/rooms/${encodeURIComponent(id)}`);
}

/** El buscador (usuario actual) se postula a una habitación publicada. */
export function postularseAHabitacion(
  listingId: string,
  message: string | null = null,
) {
  const { userId } = configuracionApi();
  return solicitud<PostulacionRespuesta>('/api/v1/applications', {
    method: 'POST',
    body: JSON.stringify({
      listingId,
      applicantId: userId,
      message: message && message.trim().length > 0 ? message.trim() : null,
      compatibilityScore: null,
    }),
  });
}
