import type { Context } from "hono";
import { errorResponse } from "../../shared/AppError.js";
import type { AuthVariables } from "../auth/index.js";
import type { AgreementsService } from "./agreements.service.js";
import { AgreementView } from "./agreements.view.js";

type AuthContext = Context<{ Variables: AuthVariables }>;

export class AgreementsController {
  constructor(private readonly service: AgreementsService) {}

  create = async (c: AuthContext) =>
    this.handle(c, async () => {
      const body = await c.req.json();
      if (typeof body.listingId !== "string") {
        return c.json({ error: "listingId es obligatorio." }, 400);
      }
      if (!body.rules || typeof body.rules !== "object" || Array.isArray(body.rules)) {
        return c.json({ error: "rules debe ser un objeto con las reglas." }, 400);
      }
      const agreement = await this.service.createForListing({
        listingId: body.listingId,
        hostId: c.get("auth").userId,
        rulesSnapshot: body.rules as Record<string, unknown>,
      });
      return c.json(AgreementView.toDTO(agreement), 201);
    });

  getById = async (c: AuthContext) =>
    this.handle(c, async () =>
      c.json(AgreementView.toDTO(await this.service.getById(c.req.param("id")!))),
    );

  accept = async (c: AuthContext) =>
    this.handle(c, async () => {
      const acceptance = await this.service.accept(
        c.req.param("id")!,
        c.get("auth").userId,
      );
      return c.json(AgreementView.toAcceptance(acceptance), 201);
    });

  listAcceptances = async (c: AuthContext) =>
    this.handle(c, async () => {
      const items = await this.service.listAcceptances(
        c.req.param("id")!,
        c.get("auth").userId,
      );
      return c.json(AgreementView.toAcceptanceList(items));
    });

  private async handle(c: AuthContext, op: () => Promise<Response>): Promise<Response> {
    try {
      return await op();
    } catch (error) {
      const response = errorResponse(error);
      return c.json({ error: response.error, code: response.code }, response.status as 400);
    }
  }
}
