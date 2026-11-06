import type {
  ISearchRepository,
  SearchFilters,
  Pagination,
  PaginatedResult,
  Profile,
  RoomListing,
} from "../../domain/index.js";

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;
export const MIN_AGE = 18;

export class SearchService {
  constructor(private readonly repo: ISearchRepository) {}

  async searchProfiles(
    filters: SearchFilters,
    pagination: Pagination,
  ): Promise<PaginatedResult<Profile>> {
    this.validateFilters(filters);
    const page = this.normalizePagination(pagination);
    const result = await this.repo.searchProfiles(filters, page);
    return this.buildPaginated(result.items, result.total, page);
  }

  async searchListings(
    filters: SearchFilters,
    pagination: Pagination,
  ): Promise<PaginatedResult<RoomListing>> {
    this.validateFilters(filters);
    const page = this.normalizePagination(pagination);
    const result = await this.repo.searchListings(filters, page);
    return this.buildPaginated(result.items, result.total, page);
  }

  /** EL-05.4 — Función: contarResultados(filtros) */
  async countResults(
    filters: SearchFilters,
  ): Promise<{ profiles: number; listings: number }> {
    this.validateFilters(filters);
    const [profiles, listings] = await Promise.all([
      this.repo.countProfiles(filters),
      this.repo.countListings(filters),
    ]);
    return { profiles, listings };
  }

  /**
   * EL-05.3 — Validación: Rangos.
   * Reglas:
   *  - presupuesto min/max >= 0 y min <= max.
   *  - edad min >= 18 y min <= max.
   *  - texto <= 120 chars.
   */
  validateFilters(filters: SearchFilters): void {
    if (filters.budgetMin != null && filters.budgetMin < 0) {
      throw new Error("El presupuesto mínimo no puede ser negativo.");
    }
    if (filters.budgetMax != null && filters.budgetMax < 0) {
      throw new Error("El presupuesto máximo no puede ser negativo.");
    }
    if (
      filters.budgetMin != null &&
      filters.budgetMax != null &&
      filters.budgetMin > filters.budgetMax
    ) {
      throw new Error(
        "El presupuesto mínimo no puede ser mayor que el máximo.",
      );
    }
    if (filters.minAge != null && filters.minAge < MIN_AGE) {
      throw new Error(`La edad mínima debe ser al menos ${MIN_AGE}.`);
    }
    if (filters.maxAge != null && filters.maxAge < MIN_AGE) {
      throw new Error(`La edad máxima debe ser al menos ${MIN_AGE}.`);
    }
    if (
      filters.minAge != null &&
      filters.maxAge != null &&
      filters.minAge > filters.maxAge
    ) {
      throw new Error("La edad mínima no puede ser mayor que la máxima.");
    }
    if (filters.text != null && filters.text.length > 120) {
      throw new Error("El texto de búsqueda supera los 120 caracteres.");
    }
  }

  private normalizePagination(pagination: Pagination): Pagination {
    const page = Math.max(1, Math.floor(pagination.page || 1));
    const requestedSize = Math.floor(
      pagination.pageSize || DEFAULT_PAGE_SIZE,
    );
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, requestedSize),
    );
    return { page, pageSize };
  }

  private buildPaginated<T>(
    items: T[],
    total: number,
    pagination: Pagination,
  ): PaginatedResult<T> {
    const totalPages =
      total === 0 ? 0 : Math.ceil(total / pagination.pageSize);
    return {
      items,
      page: pagination.page,
      pageSize: pagination.pageSize,
      total,
      totalPages,
    };
  }
}
