import type { Context } from "hono";
import type { AuthService } from "../auth/auth.service.js";
import { AnalyticsError, AnalyticsService } from "./analytics.service.js";

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
  constructor(
    private readonly service: AnalyticsService,
    private readonly authService: AuthService,
  ) {}

  getDashboard = async (context: Context) => {
    const authorization = context.req.header("Authorization");
    const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    const userId = token ? this.authService.getUserIdForToken(token) : null;
    const startValue = context.req.query("start");
    const endValue = context.req.query("end");
    const start = parseDate(startValue);
    const endDate = parseDate(endValue);

    if (!userId) {
      return context.json({ error: "Debes iniciar sesión para consultar las métricas." }, 401);
    }
    if (!start || !endDate) {
      return context.json(
        { error: "Indica fechas válidas con formato YYYY-MM-DD." },
        400,
      );
    }
    if (start > endDate) {
      return context.json(
        { error: "La fecha inicial debe ser anterior o igual a la fecha final." },
        400,
      );
    }
    if (endDate > addMonths(start, 12)) {
      return context.json(
        { error: "El rango de fechas no puede superar los 12 meses." },
        400,
      );
    }

    const end = new Date(endDate.getTime() + 86_400_000 - 1);
    try {
      return context.json(
        await this.service.getDashboard(userId, start, end),
        200,
      );
    } catch (error) {
      if (error instanceof AnalyticsError) {
        return context.json({ error: error.message }, error.statusCode);
      }
      console.error("Error en el módulo de analítica:", error);
      return context.json({ error: "No se pudieron consultar las métricas." }, 500);
    }
  };
}
