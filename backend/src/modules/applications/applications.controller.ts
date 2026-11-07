import type { Context } from "hono";
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
}

export class ApplicationsController {
  constructor(
    private applicationsService: ApplicationsService,
    private readonly deps: ApplicationsControllerDependencies,
  ) {}

  apply = async (c: AuthContext) => {
    try {
      const body = await c.req.json();
      if (!body.listingId) {
        return c.json({ error: "listingId es obligatorio" }, 400);
      }

      const app = await this.applicationsService.apply({
        listingId: body.listingId,
        applicantId: c.get("auth").userId,
        message: body.message ?? null,
        compatibilityScore:
          body.compatibilityScore != null ? Number(body.compatibilityScore) : null,
      });

      return c.json(ApplicationView.toResponse(app), 201);
    } catch (err: any) {
      return c.json({ error: err.message ?? "Error al enviar solicitud" }, 400);
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
      const body = await c.req.json();
      if (body.decision !== "accept" && body.decision !== "reject") {
        return c.json({ error: "decision debe ser 'accept' o 'reject'" }, 400);
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

      const updated = await this.applicationsService.decide(id, body.decision);
      return c.json(ApplicationView.toResponse(updated), 200);
    } catch (err: any) {
      return c.json({ error: err.message ?? "Error al resolver solicitud" }, 400);
    }
  };
}
