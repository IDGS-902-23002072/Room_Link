import { solicitud } from '@/modulos/compatibilidad/api';

export type RoomCostKind =
  | 'rent'
  | 'service'
  | 'deposit'
  | 'maintenance'
  | 'other';

export interface ReglasInmuebleBackend {
  visitsPolicy: string | null;
  partiesAllowed: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  petsAllowed: boolean;
  smokingAllowed: boolean;
  commonAreasNotes: string | null;
  extraRules: string | null;
}

export interface CostoInmuebleBackend {
  id?: string;
  kind: RoomCostKind;
  concept: string;
  amount: number;
  isIncluded: boolean;
  isProrated: boolean;
}

export interface DetalleInmuebleBackend {
  id: string;
  hostId: string;
  title: string;
  description: string | null;
  monthlyRent: number;
  status: string;
  photosCount: number;
  availableFrom: string | null;
  maxRoommates: number | null;
  location: {
    address: string;
    latitude: number;
    longitude: number;
  } | null;
  photos: {
    id: string;
    fileName: string;
    position: number;
  }[];
  rules: ReglasInmuebleBackend | null;
  costItems: CostoInmuebleBackend[];
}

export function obtenerDetalleInmueble(listingId: string) {
  return solicitud<DetalleInmuebleBackend>(
    `/api/v1/rooms/${encodeURIComponent(listingId)}`,
  );
}

export function guardarReglasInmueble(
  listingId: string,
  rules: ReglasInmuebleBackend,
) {
  return solicitud<{ listingId: string; rules: ReglasInmuebleBackend }>(
    `/api/v1/rooms/${encodeURIComponent(listingId)}/rules`,
    {
      method: 'PUT',
      body: JSON.stringify(rules),
    },
  );
}

export function guardarCostosInmueble(
  listingId: string,
  items: Omit<CostoInmuebleBackend, 'id'>[],
) {
  return solicitud<{ listingId: string; items: CostoInmuebleBackend[] }>(
    `/api/v1/rooms/${encodeURIComponent(listingId)}/costs`,
    {
      method: 'PUT',
      body: JSON.stringify({ items }),
    },
  );
}
