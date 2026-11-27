import type { Context } from "hono";
import { AppError, errorResponse } from "../../shared/AppError.js";
import type { AuthVariables } from "../auth/index.js";
import type { MonitoringAdminService } from "./monitoring-admin.service.js";

type AuthContext = Context<{ Variables: AuthVariables }>;

const OFFSET_MS = 6 * 60 * 60 * 1000;

/** Neutraliza fórmulas de hoja de cálculo y escapa comillas. */
function csvCell(value: unknown): string {
  const text = String(value ?? "");
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

const localStamp = (date: Date): string =>
  new Date(date.getTime() - OFFSET_MS).toISOString().replace("T", " ").slice(0, 19);

export class MonitoringAdminController {
  constructor(private readonly service: MonitoringAdminService) {}

  summary = async (c: AuthContext): Promise<Response> =>
    this.handle(c, async () => c.json(await this.service.summary(c.req.query())));

  slis = async (c: AuthContext): Promise<Response> =>
    this.handle(c, async () => c.json(await this.service.slis(c.req.query())));

  runs = async (c: AuthContext): Promise<Response> =>
    this.handle(c, async () => c.json(await this.service.runs(c.req.query())));

  run = async (c: AuthContext): Promise<Response> =>
    this.handle(c, async () => c.json(await this.service.run(c.req.param("id") ?? "")));

  logbook = async (c: AuthContext): Promise<Response> =>
    this.handle(c, async () => c.json(await this.service.logbook(c.req.query())));

  suites = async (c: AuthContext): Promise<Response> =>
    this.handle(c, async () => c.json({ items: this.service.suites() }));

  runTests = async (c: AuthContext): Promise<Response> =>
    this.handle(c, async () => {
      const contentType = c.req.header("content-type") ?? "";
      if (!contentType.toLowerCase().includes("application/json")) {
        throw new AppError("Se requiere Content-Type: application/json.", 400, "BODY_CONTENT_TYPE");
      }
      let body: unknown;
      try {
        body = JSON.parse(await c.req.text());
      } catch {
        throw new AppError("El cuerpo debe ser JSON válido.", 400, "BODY_INVALID");
      }
      const suite =
        typeof body === "object" && body !== null && "suite" in body ? body.suite : undefined;
      if (typeof suite !== "string") {
        throw new AppError("Indica la suite en el campo 'suite'.", 400, "SUITE_INVALID");
      }
      return c.json(await this.service.executeTests(suite));
    });

  exportRequests = async (c: AuthContext): Promise<Response> =>
    this.handle(c, async () => {
      const { period, rows } = await this.service.exportRequests(c.req.query("month"));
      const header = [
        "period",
        "occurred_at_utc6",
        "request_id",
        "method",
        "route_pattern",
        "status",
        "duration_ms",
        "role",
        "sli_id",
        "source",
        "is_good",
      ];
      const lines = [header.map(csvCell).join(",")];
      for (const row of rows) {
        lines.push(
          [
            period,
            localStamp(row.occurredAt),
            row.requestId,
            row.method,
            row.routePattern,
            row.status,
            row.durationMs,
            row.role,
            row.sliId,
            row.source,
            row.isGood,
          ]
            .map(csvCell)
            .join(","),
        );
      }
      return c.text(`\uFEFF${lines.join("\r\n")}\r\n`, 200, {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="solicitudes-${period}.csv"`,
      });
    });

  private async handle(c: AuthContext, operation: () => Promise<Response>): Promise<Response> {
    try {
      return await operation();
    } catch (error) {
      const response = errorResponse(error);
      return c.json({ error: response.error, code: response.code }, response.status as 400);
    }
  }
}
