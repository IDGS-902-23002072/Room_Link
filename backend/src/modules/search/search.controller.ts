import type { Context } from "hono";
import type { SearchService } from "./search.service.js";
import { SearchView } from "./search.view.js";
import type { SearchFilters, Pagination } from "../../domain/index.js";

const asNumber = (value: string | undefined): number | null => {
  if (value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const asBoolean = (value: string | undefined): boolean | null => {
  if (value === undefined || value === "") return null;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return null;
};

const parseFilters = (c: Context): SearchFilters => ({
  budgetMin: asNumber(c.req.query("budgetMin")),
  budgetMax: asNumber(c.req.query("budgetMax")),
  minAge: asNumber(c.req.query("minAge")),
  maxAge: asNumber(c.req.query("maxAge")),
  zoneId: c.req.query("zoneId") ?? null,
  petsAllowed: asBoolean(c.req.query("petsAllowed")),
  smokingAllowed: asBoolean(c.req.query("smokingAllowed")),
  partiesAllowed: asBoolean(c.req.query("partiesAllowed")),
  text: c.req.query("text") ?? null,
});

const parsePagination = (c: Context): Pagination => ({
  page: Number(c.req.query("page") ?? 1),
  pageSize: Number(c.req.query("pageSize") ?? 20),
});

export class SearchController {
  constructor(private searchService: SearchService) {}

  searchProfiles = async (c: Context) => {
    try {
      const result = await this.searchService.searchProfiles(
        parseFilters(c),
        parsePagination(c),
      );
      return c.json(SearchView.toProfilesPage(result), 200);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error al buscar perfiles";
      return c.json({ error: msg }, 400);
    }
  };

  searchListings = async (c: Context) => {
    try {
      const result = await this.searchService.searchListings(
        parseFilters(c),
        parsePagination(c),
      );
      return c.json(SearchView.toListingsPage(result), 200);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error al buscar habitaciones";
      return c.json({ error: msg }, 400);
    }
  };

  countResults = async (c: Context) => {
    try {
      const counts = await this.searchService.countResults(parseFilters(c));
      return c.json(counts, 200);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error al contar resultados";
      return c.json({ error: msg }, 400);
    }
  };
}
