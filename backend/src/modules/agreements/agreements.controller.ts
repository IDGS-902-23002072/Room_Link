import type { Context } from "hono";
import type { AgreementsService } from "./agreements.service.js";
import { AgreementsView } from "./agreements.view.js";

export class AgreementsController {
  constructor(private service: AgreementsService) {}

  generarAcuerdo = async (c: Context) => {
    try {
      const body = (await c.req.json()) as Record<string, unknown>;
      const listingId = body["listingId"];
      const hostId = body["hostId"];
      const roomieId = body["roomieId"];
      if (!listingId || !hostId || !roomieId) {
        return c.json(
          { error: "listingId, hostId y roomieId son obligatorios" },
          400,
        );
      }
      const agreement = await this.service.generarAcuerdo({
        listingId: String(listingId),
        hostId: String(hostId),
        roomieId: String(roomieId),
      });
      return c.json(AgreementsView.toDto(agreement), 201);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error al generar el acuerdo";
      return c.json({ error: msg }, 400);
    }
  };

  aceptarAcuerdo = async (c: Context) => {
    try {
      const agreementId = c.req.param("agreementId");
      if (!agreementId) {
        return c.json({ error: "agreementId es obligatorio" }, 400);
      }
      const body = (await c.req.json()) as Record<string, unknown>;
      const userId = body["userId"];
      if (!userId) {
        return c.json({ error: "userId es obligatorio en el cuerpo" }, 400);
      }
      const agreement = await this.service.aceptarAcuerdo(
        agreementId,
        String(userId),
      );
      return c.json(AgreementsView.toDto(agreement), 200);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error al aceptar el acuerdo";
      const status =
        err instanceof Error && /no encontrado/i.test(err.message) ? 404 : 400;
      return c.json({ error: msg }, status);
    }
  };

  crearNuevaVersion = async (c: Context) => {
    try {
      const agreementId = c.req.param("agreementId");
      if (!agreementId) {
        return c.json({ error: "agreementId es obligatorio" }, 400);
      }
      const next = await this.service.crearNuevaVersion(agreementId);
      return c.json(AgreementsView.toDto(next), 201);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error al crear nueva versión";
      const status =
        err instanceof Error && /no encontrado/i.test(err.message) ? 404 : 400;
      return c.json({ error: msg }, status);
    }
  };

  getAgreement = async (c: Context) => {
    try {
      const agreementId = c.req.param("agreementId");
      if (!agreementId) {
        return c.json({ error: "agreementId es obligatorio" }, 400);
      }
      const agreement = await this.service.getAgreement(agreementId);
      return c.json(AgreementsView.toDto(agreement), 200);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Acuerdo no encontrado";
      return c.json({ error: msg }, 404);
    }
  };

  listForListing = async (c: Context) => {
    const listingId = c.req.param("listingId");
    if (!listingId) {
      return c.json({ error: "listingId es obligatorio" }, 400);
    }
    const items = await this.service.listAgreementsForListing(listingId);
    return c.json({ items: items.map(AgreementsView.toDto) }, 200);
  };

  listForUser = async (c: Context) => {
    const userId = c.req.param("userId");
    if (!userId) {
      return c.json({ error: "userId es obligatorio" }, 400);
    }
    const items = await this.service.listAgreementsForUser(userId);
    return c.json({ items: items.map(AgreementsView.toDto) }, 200);
  };
}
