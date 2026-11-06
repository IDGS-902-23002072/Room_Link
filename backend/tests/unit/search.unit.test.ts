import { describe, expect, it, beforeEach } from "vitest";
import {
  Profile,
  RoomListing,
  type ISearchRepository,
  type SearchFilters,
  type Pagination,
} from "../../src/domain/index.js";
import { SearchService } from "../../src/modules/search/search.service.js";

/**
 * HU-05 — Filtros de búsqueda.
 * Cubre EL-05.3 (validación de rangos), EL-05.4 (contar),
 * EL-05.6 (buscarPerfiles) y EL-05.7 (buscarHabitaciones).
 */

class FakeSearchRepository implements ISearchRepository {
  public lastProfileFilters: SearchFilters | null = null;
  public lastListingFilters: SearchFilters | null = null;
  constructor(
    private profiles: Profile[],
    private listings: RoomListing[],
  ) {}
  async searchProfiles(
    filters: SearchFilters,
    pagination: Pagination,
  ): Promise<{ items: Profile[]; total: number }> {
    this.lastProfileFilters = filters;
    const offset = (pagination.page - 1) * pagination.pageSize;
    return {
      items: this.profiles.slice(offset, offset + pagination.pageSize),
      total: this.profiles.length,
    };
  }
  async searchListings(
    filters: SearchFilters,
    pagination: Pagination,
  ): Promise<{ items: RoomListing[]; total: number }> {
    this.lastListingFilters = filters;
    const offset = (pagination.page - 1) * pagination.pageSize;
    return {
      items: this.listings.slice(offset, offset + pagination.pageSize),
      total: this.listings.length,
    };
  }
  async countProfiles(filters: SearchFilters): Promise<number> {
    this.lastProfileFilters = filters;
    return this.profiles.length;
  }
  async countListings(filters: SearchFilters): Promise<number> {
    this.lastListingFilters = filters;
    return this.listings.length;
  }
}

const buildProfile = (userId: string): Profile =>
  new Profile({
    userId,
    fullName: `Usuario ${userId}`,
    birthDate: new Date("2000-01-01"),
    identityStatus: "unverified",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

const buildListing = (id: string, rent: number): RoomListing =>
  new RoomListing({
    id,
    hostId: "host-1",
    title: `Depa ${id}`,
    monthlyRent: rent,
    status: "published",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

describe("SearchService (Roberto, HU-05)", () => {
  let repo: FakeSearchRepository;
  let service: SearchService;

  beforeEach(() => {
    repo = new FakeSearchRepository(
      Array.from({ length: 23 }, (_, i) => buildProfile(`u${i + 1}`)),
      Array.from({ length: 11 }, (_, i) =>
        buildListing(`l${i + 1}`, 3000 + i * 200),
      ),
    );
    service = new SearchService(repo);
  });

  describe("validateFilters — EL-05.3", () => {
    it("acepta filtros vacíos", () => {
      expect(() => service.validateFilters({})).not.toThrow();
    });

    it("rechaza presupuestos negativos", () => {
      expect(() =>
        service.validateFilters({ budgetMin: -1 } as SearchFilters),
      ).toThrow(/presupuesto mínimo/i);
    });

    it("rechaza presupuesto min > max", () => {
      expect(() =>
        service.validateFilters({
          budgetMin: 5000,
          budgetMax: 3000,
        } as SearchFilters),
      ).toThrow(/mayor que el máximo/);
    });

    it("rechaza edad mínima menor que 18", () => {
      expect(() =>
        service.validateFilters({ minAge: 17 } as SearchFilters),
      ).toThrow(/al menos 18/);
    });

    it("rechaza edad min > max", () => {
      expect(() =>
        service.validateFilters({ minAge: 30, maxAge: 25 } as SearchFilters),
      ).toThrow(/mayor que la máxima/);
    });

    it("rechaza texto excesivamente largo", () => {
      expect(() =>
        service.validateFilters({ text: "x".repeat(121) } as SearchFilters),
      ).toThrow(/120 caracteres/);
    });
  });

  describe("searchProfiles — EL-05.6", () => {
    it("pagina y calcula totalPages", async () => {
      const result = await service.searchProfiles(
        {},
        { page: 2, pageSize: 10 },
      );
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(10);
      expect(result.total).toBe(23);
      expect(result.totalPages).toBe(3);
      expect(result.items).toHaveLength(10);
    });

    it("clamp pageSize al máximo permitido (50)", async () => {
      const result = await service.searchProfiles(
        {},
        { page: 1, pageSize: 500 },
      );
      expect(result.pageSize).toBe(50);
    });

    it("propaga los filtros al repositorio", async () => {
      await service.searchProfiles(
        { zoneId: "zone-1", minAge: 20, maxAge: 35 },
        { page: 1, pageSize: 10 },
      );
      expect(repo.lastProfileFilters?.zoneId).toBe("zone-1");
      expect(repo.lastProfileFilters?.minAge).toBe(20);
    });
  });

  describe("searchListings — EL-05.7", () => {
    it("pagina habitaciones y respeta pageSize", async () => {
      const result = await service.searchListings(
        {},
        { page: 1, pageSize: 5 },
      );
      expect(result.items).toHaveLength(5);
      expect(result.total).toBe(11);
      expect(result.totalPages).toBe(3);
    });

    it("propaga filtros de hábito estricto", async () => {
      await service.searchListings(
        { petsAllowed: false, smokingAllowed: false, partiesAllowed: false },
        { page: 1, pageSize: 10 },
      );
      expect(repo.lastListingFilters).toEqual(
        expect.objectContaining({
          petsAllowed: false,
          smokingAllowed: false,
          partiesAllowed: false,
        }),
      );
    });
  });

  describe("countResults — EL-05.4", () => {
    it("devuelve totales independientes para perfiles y habitaciones", async () => {
      const result = await service.countResults({});
      expect(result.profiles).toBe(23);
      expect(result.listings).toBe(11);
    });

    it("también valida los rangos antes de contar", async () => {
      await expect(
        service.countResults({ budgetMin: -5 } as SearchFilters),
      ).rejects.toThrow(/presupuesto mínimo/i);
    });
  });
});
