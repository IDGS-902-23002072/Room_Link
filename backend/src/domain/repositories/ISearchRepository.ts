import type { CompatibilityFeedCandidate } from "./ICompatibilityRepository.js";
import type { Profile } from "../entities/Profile.js";
import type { RoomListing } from "../entities/RoomListing.js";

export const searchHabits = ["noise", "smoking", "cleanliness", "visits"] as const;
export type SearchHabit = typeof searchHabits[number];
export type SearchZone = { name: string; city: string };
export type SearchProfileDetails = Omit<CompatibilityFeedCandidate, "userId" | "fullName" | "age" | "bio" | "occupation">;

export interface SearchFilters {
  // Rangos económicos / edad (EL-05.3)
  budgetMin?: number | null;
  budgetMax?: number | null;
  minAge?: number | null;
  maxAge?: number | null;

  // Zona y preferencias (EL-05.1)
  zoneId?: string | null;
  city?: string;
  zones?: string[];
  viewerId?: string;
  order?: string;
  habits?: { dimension: SearchHabit; score: number; required: boolean }[];
  availableNow?: boolean;

  // Hábitos estrictos (EL-05.2 — 0 tolerancia)
  petsAllowed?: boolean | null;
  smokingAllowed?: boolean | null;
  partiesAllowed?: boolean | null;

  // Búsqueda textual (opcional)
  text?: string | null;
}

export interface Pagination {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ISearchRepository {
  /** EL-05.6 — Consulta: buscarPerfiles(filtros, pagina) */
  searchProfiles(
    filters: SearchFilters,
    pagination: Pagination,
  ): Promise<{ items: Profile[]; total: number; details?: Map<string, SearchProfileDetails> }>;

  /** EL-05.7 — Consulta: buscarHabitaciones(filtros, pagina) */
  searchListings(
    filters: SearchFilters,
    pagination: Pagination,
  ): Promise<{ items: RoomListing[]; total: number }>;

  /** EL-05.4 — Función: contarResultados(filtros) */
  listZones?(): Promise<SearchZone[]>;
  countProfiles(filters: SearchFilters): Promise<number>;
  countListings(filters: SearchFilters): Promise<number>;
}
