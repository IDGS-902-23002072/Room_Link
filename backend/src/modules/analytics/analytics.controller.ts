import type { Context } from "hono";
import { errorResponse } from "../../shared/AppError.js";
import type { AuthVariables } from "../auth/index.js";
import type { AnalyticsService } from "./analytics.service.js";
import { AnalyticsView } from "./analytics.view.js";

type AuthContext = Context<{ Variables: AuthVariables }>;

function parseDate(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10) === value ? date : null;
}

function addMonths(date: Date, months: number): Date {
  const targetMonth = date.getUTCMonth() + months;
  const year = date.getUTCFullYear() + Math.floor(targetMonth / 12);
  const month = targetMonth % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(year, month, Math.min(date.getUTCDate(), lastDay)),
  );
}

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
      const startRaw = c.req.query("start");
      const endRaw = c.req.query("end");
      if (startRaw !== undefined || endRaw !== undefined) {
        const start = parseDate(startRaw);
        const endDate = parseDate(endRaw);
        if (!start || !endDate) {
          return c.json(
            { error: "Indica fechas válidas con formato YYYY-MM-DD." },
            400,
          );
        }
        if (start > endDate) {
          return c.json(
            {
              error:
                "La fecha inicial debe ser anterior o igual a la fecha final.",
            },
            400,
          );
        }
        if (endDate > addMonths(start, 12)) {
          return c.json(
            { error: "El rango de fechas no puede superar los 12 meses." },
            400,
          );
        }
        const end = new Date(endDate.getTime() + 86_400_000 - 1);
        const dashboard = await this.service.getDashboard(start, end);
        return c.json(dashboard, 200);
      }

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
