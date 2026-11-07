import type { Context } from "hono";
import { errorResponse } from "../../shared/AppError.js";
import type { AuthVariables } from "../auth/index.js";
import type { AnalyticsService } from "./analytics.service.js";
import { AnalyticsView } from "./analytics.view.js";

type AuthContext = Context<{ Variables: AuthVariables }>;

export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  recompute = async (c: AuthContext) =>
    this.handle(c, async () => {
      const raw = c.req.query("date");
      if (!raw) return c.json({ error: "date es obligatorio (YYYY-MM-DD)." }, 400);
      const day = new Date(`${raw}T00:00:00.000Z`);
      const metrics = await this.service.recomputeDaily(day);
      return c.json(AnalyticsView.toDTO(metrics));
    });

  getRange = async (c: AuthContext) =>
    this.handle(c, async () => {
      const fromRaw = c.req.query("from");
      const toRaw = c.req.query("to");
      if (!fromRaw || !toRaw) {
        return c.json({ error: "from y to son obligatorios (YYYY-MM-DD)." }, 400);
      }
      const from = new Date(`${fromRaw}T00:00:00.000Z`);
      const to = new Date(`${toRaw}T00:00:00.000Z`);
      const items = await this.service.getRange(from, to);
      return c.json({ items: AnalyticsView.toList(items) });
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
