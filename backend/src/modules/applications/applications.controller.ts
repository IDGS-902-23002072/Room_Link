import type { Context } from "hono";
import { errorResponse } from "../../shared/AppError.js";
import type { AuthVariables } from "../auth/index.js";
import type { ApplicationsService } from "./applications.service.js";
import { ApplicationView } from "./applications.view.js";

type AuthContext = Context<{ Variables: AuthVariables }>;

export interface ApplicationsControllerDependencies {
  /**
   * Devuelve el `hostId` del listing o `null` si no existe.
   * Inyectado desde `app.ts` para no acoplar el controller al `RoomListingRepository`.
   */
  resolveListingHostId: (listingId: string) => Promise<string | null>;
  /**
   * HU-07 — Calcula en el servidor el % de afinidad entre postulante y anfitrión.
   * Inyectado desde `app.ts` (módulo de compatibilidad) para que el cliente no
   * pueda falsear el score. Devuelve `null` si no se puede calcular (sin test, etc.).
   */
  resolveCompatibilityScore: (
    applicantId: string,
    hostId: string,
  ) => Promise<number | null>;
}

export class ApplicationsController {
  constructor(
    private applicationsService: ApplicationsService,
    private readonly deps: ApplicationsControllerDependencies,
  ) {}

  apply = async (c: AuthContext) => {
    try {
      const body = await c.req.json();
      if (typeof body.listingId !== "string" || !body.listingId.trim()) {
        return c.json({ error: "listingId es obligatorio" }, 400);
      }

      const applicantId = c.get("auth").userId;
      // #8 — No puedes postularte a tu propia publicación.
      const hostId = await this.deps.resolveListingHostId(body.listingId);
      if (hostId && hostId === applicantId) {
        return c.json(
          { error: "No puedes postularte a tu propia publicación." },
          400,
        );
      }

      // HU-07 — El % de afinidad lo calcula el servidor; se ignora el valor del cliente.
      const compatibilityScore = hostId
        ? await this.deps.resolveCompatibilityScore(applicantId, hostId)
        : null;

      const app = await this.applicationsService.apply({
        listingId: body.listingId,
        applicantId,
        message: body.message ?? null,
        compatibilityScore,
      });

      return c.json(ApplicationView.toResponse(app), 201);
    } catch (err: unknown) {
      const { error, code, status } = errorResponse(err);
      return c.json({ error, code }, status as 400 | 409 | 500);
    }
  };

  getMine = async (c: AuthContext) => {
    try {
      const applications = await this.applicationsService.getByApplicant(c.get("auth").userId);
      return c.json(ApplicationView.toList(applications));
    } catch {
      return c.json({ error: "No se pudieron obtener tus postulaciones." }, 500);
    }
  };

  getByListing = async (c: AuthContext) => {
    try {
      const listingId = c.req.param("listingId");
      if (!listingId) {
        return c.json({ error: "listingId es obligatorio" }, 400);
      }
      const principal = c.get("auth");
      const hostId = await this.deps.resolveListingHostId(listingId);
      if (!hostId) {
        return c.json({ error: "Listing no encontrado" }, 404);
      }
      if (hostId !== principal.userId && !principal.roles.includes("admin")) {
        return c.json(
          { error: "Solo el anfitrión puede ver las solicitudes del listing.", code: "FORBIDDEN" },
          403,
        );
      }
      const list = await this.applicationsService.getByListing(listingId);
      return c.json(ApplicationView.toList(list), 200);
    } catch (err: any) {
      return c.json({ error: err.message ?? "Error al obtener solicitudes" }, 500);
    }
  };

  decide = async (c: AuthContext) => {
    try {
      const id = c.req.param("id");
      if (!id) {
        return c.json({ error: "id es obligatorio" }, 400);
      }
      const body = await c.req.json().catch(() => null);
      const decision = body?.decision;
      if (decision !== "accept" && decision !== "reject" && decision !== "waitlist") {
        return c.json({ error: "decision debe ser 'accept', 'reject' o 'waitlist'" }, 400);
      }

      // Buscar el application para derivar el listing y validar ownership
      const existing = await this.applicationsService.getById(id);
      if (!existing) {
        return c.json({ error: "Solicitud no encontrada" }, 404);
      }
      const principal = c.get("auth");
      const hostId = await this.deps.resolveListingHostId(existing.listingId);
      if (hostId !== principal.userId && !principal.roles.includes("admin")) {
        return c.json(
          { error: "Solo el anfitrión puede decidir sobre esta solicitud.", code: "FORBIDDEN" },
          403,
        );
      }

      const updated = await this.applicationsService.decide(id, decision);
      return c.json(ApplicationView.toResponse(updated), 200);
    } catch (err: unknown) {
      const { error, code, status } = errorResponse(err);
      return c.json({ error, code }, status as 400 | 404 | 409 | 500);
    }
  };
}
