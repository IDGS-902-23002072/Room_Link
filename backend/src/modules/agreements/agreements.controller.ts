import type { AgreementDraftDetails } from "../../domain/entities/Agreement.js";
import type { Context } from "hono";
import type { AgreementsService } from "./agreements.service.js";
import { AgreementsView } from "./agreements.view.js";

function parseDetails(value: unknown): AgreementDraftDetails | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Los detalles del acuerdo deben ser un objeto.");
  }
  const { title, startDate, rules } = value as Record<string, unknown>;
  function boundedText(text: unknown, max: number) {
    if (typeof text !== "string" || !text.trim() || text.trim().length > max) {
      throw new Error(`El texto del acuerdo debe tener entre 1 y ${max} caracteres.`);
    }
    return text.trim();
  }
  if (startDate !== undefined) {
    if (typeof startDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      throw new Error("La fecha de inicio debe tener formato AAAA-MM-DD.");
    }
    const date = new Date(startDate);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== startDate) {
      throw new Error("La fecha de inicio no es válida.");
    }
  }
  if (!Array.isArray(rules) || rules.length > 20) {
    throw new Error("El acuerdo admite hasta 20 normas personalizadas.");
  }
  return {
    ...(title === undefined ? {} : { title: boundedText(title, 160) }),
    ...(startDate === undefined ? {} : { startDate }),
    rules: rules.map((entry: unknown) => {
      if (!entry || typeof entry !== "object") throw new Error("Norma del acuerdo inválida.");
      const { category, title, description } = entry as Record<string, unknown>;
      return { category: boundedText(category, 60), title: boundedText(title, 120), description: boundedText(description, 2000) };
    }),
  };
}

export class AgreementsController {
  constructor(
    private readonly service: AgreementsService,
    private readonly hasAcceptedApplication: (listingId: string, roomieId: string) => Promise<boolean>,
  ) {}

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
      if (hostId !== c.get("auth").userId) return c.json({ error: "Acceso denegado" }, 403);
      if (!(await this.hasAcceptedApplication(String(listingId), String(roomieId)))) {
        return c.json({ error: "El roomie debe tener una solicitud aceptada para este anuncio." }, 400);
      }
      const details = parseDetails(body.details);
      const agreement = await this.service.generarAcuerdo({
        listingId: String(listingId),
        hostId: String(hostId),
        roomieId: String(roomieId),
        ...(details ? { details } : {}),
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
      // Se acepta en nombre del usuario autenticado, no de un userId del body (RNF-01.2).
      const userId = c.get("auth").userId as string;
      const agreement = await this.service.aceptarAcuerdo(
        agreementId,
        userId,
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
      const previous = await this.service.getAgreement(agreementId);
      if (previous.hostId !== c.get("auth").userId) return c.json({ error: "Acceso denegado" }, 403);
      const raw = await c.req.text();
      const details = raw ? parseDetails(JSON.parse(raw)?.details) : undefined;
      const next = await this.service.crearNuevaVersion(agreementId, details);
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
      const userId = c.get("auth").userId as string;
      if (!agreement.isParticipant(userId)) {
        return c.json({ error: "Acceso denegado" }, 403);
      }
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
    const userId = c.get("auth").userId as string;
    const items = (await this.service.listAgreementsForListing(listingId)).filter(
      (agreement) => agreement.isParticipant(userId),
    );
    return c.json({ items: items.map(AgreementsView.toDto) }, 200);
  };

  listForUser = async (c: Context) => {
    const userId = c.req.param("userId");
    if (!userId) {
      return c.json({ error: "userId es obligatorio" }, 400);
    }
    if (userId !== c.get("auth").userId) return c.json({ error: "Acceso denegado" }, 403);
    const items = await this.service.listAgreementsForUser(userId);
    return c.json({ items: items.map(AgreementsView.toDto) }, 200);
  };
}
