import type { Context } from "hono";
import { errorResponse } from "../../shared/AppError.js";
import type { SanctionType } from "../../domain/index.js";
import type { AuthVariables } from "../auth/index.js";
import type { SanctionsService } from "./sanctions.service.js";
import { SanctionView } from "./sanctions.view.js";

type AuthContext = Context<{ Variables: AuthVariables }>;

export class SanctionsController {
  constructor(private readonly service: SanctionsService) {}

  issue = async (c: AuthContext) =>
    this.handle(c, async () => {
      const body = await c.req.json();
      const expiresAtRaw =
        typeof body.expiresAt === "string" ? new Date(body.expiresAt) : null;
      const expiresAt =
        expiresAtRaw && !Number.isNaN(expiresAtRaw.getTime()) ? expiresAtRaw : null;
      const sanction = await this.service.issue({
        adminId: c.get("auth").userId,
        reportId: typeof body.reportId === "string" ? body.reportId : null,
        userId: typeof body.userId === "string" ? body.userId : null,
        listingId: typeof body.listingId === "string" ? body.listingId : null,
        type: body.type as SanctionType,
        reason: typeof body.reason === "string" ? body.reason : "",
        expiresAt,
      });
      return c.json(SanctionView.toDTO(sanction), 201);
    });

  listForUser = async (c: AuthContext) =>
    this.handle(c, async () => {
      const userId = c.req.query("userId");
      if (!userId) {
        return c.json({ error: "userId es obligatorio." }, 400);
      }
      const items = await this.service.listForUser(userId);
      return c.json(SanctionView.toList(items));
    });

  revoke = async (c: AuthContext) =>
    this.handle(c, async () => {
      await this.service.revoke(c.req.param("id")!);
      return c.json({ ok: true });
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
