import type { Context } from "hono";
import type { ApplicationsService } from "./applications.service.js";
import { ApplicationView } from "./applications.view.js";

export class ApplicationsController {
  constructor(private applicationsService: ApplicationsService) {}

  apply = async (c: Context) => {
    try {
      const body = await c.req.json();
      if (!body.listingId || !body.applicantId) {
        return c.json(
          { error: "listingId y applicantId son obligatorios" },
          400,
        );
      }

      const app = await this.applicationsService.apply({
        listingId: body.listingId,
        applicantId: body.applicantId,
        message: body.message ?? null,
        compatibilityScore: body.compatibilityScore != null
          ? Number(body.compatibilityScore)
          : null,
      });

      return c.json(ApplicationView.toResponse(app), 201);
    } catch (err: any) {
      return c.json({ error: err.message ?? "Error al enviar solicitud" }, 400);
    }
  };

  getByListing = async (c: Context) => {
    try {
      const listingId = c.req.param("listingId");
      if (!listingId) {
        return c.json({ error: "listingId es obligatorio" }, 400);
      }
      const list = await this.applicationsService.getByListing(listingId);
      return c.json(ApplicationView.toList(list), 200);
    } catch (err: any) {
      return c.json({ error: err.message ?? "Error al obtener solicitudes" }, 500);
    }
  };

  decide = async (c: Context) => {
    try {
      const id = c.req.param("id");
      if (!id) {
        return c.json({ error: "id es obligatorio" }, 400);
      }
      const body = await c.req.json();
      if (body.decision !== "accept" && body.decision !== "reject") {
        return c.json({ error: "decision debe ser 'accept' o 'reject'" }, 400);
      }

      const updated = await this.applicationsService.decide(id, body.decision);
      return c.json(ApplicationView.toResponse(updated), 200);
    } catch (err: any) {
      return c.json({ error: err.message ?? "Error al resolver solicitud" }, 400);
    }
  };
}
