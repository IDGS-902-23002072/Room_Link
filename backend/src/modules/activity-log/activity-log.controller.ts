import type { Context } from "hono";
import { errorResponse } from "../../shared/AppError.js";
import type { ActivityLogFilter } from "../../domain/index.js";
import type { AuthVariables } from "../auth/index.js";
import type { ActivityLogService } from "./activity-log.service.js";
import { ActivityLogView } from "./activity-log.view.js";

type AuthContext = Context<{ Variables: AuthVariables }>;

export class ActivityLogController {
  constructor(private readonly service: ActivityLogService) {}

  list = async (c: AuthContext) =>
    this.handle(c, async () => {
      const filter: ActivityLogFilter = {};
      const userId = c.req.query("userId");
      const action = c.req.query("action");
      const from = c.req.query("from");
      const to = c.req.query("to");
      const limitRaw = Number(c.req.query("limit") ?? 50);
      const offsetRaw = Number(c.req.query("offset") ?? 0);

      if (userId) filter.userId = userId;
      if (action) filter.action = action;
      if (from) {
        const d = new Date(from);
        if (!Number.isNaN(d.getTime())) filter.from = d;
      }
      if (to) {
        const d = new Date(to);
        if (!Number.isNaN(d.getTime())) filter.to = d;
      }
      filter.limit = Number.isInteger(limitRaw) && limitRaw > 0 && limitRaw <= 500 ? limitRaw : 50;
      filter.offset = Number.isInteger(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;

      const [items, total] = await Promise.all([
        this.service.list(filter),
        this.service.count(filter),
      ]);
      return c.json({ items: ActivityLogView.toList(items), total });
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
