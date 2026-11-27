import type { Context } from "hono";
import { type IngestOutcome, MonitoringIngestService } from "./monitoring.service.js";

const isFailure = (value: unknown): value is Extract<IngestOutcome, { accepted: false }> =>
  typeof value === "object" && value !== null && "accepted" in value && value.accepted === false;

export class MonitoringIngestController {
  constructor(
    private readonly service: MonitoringIngestService,
    private readonly maxBytes: number,
  ) {}

  private async readJson(
    context: Context,
  ): Promise<{ value: unknown } | { failure: Extract<IngestOutcome, { accepted: false }> }> {
    const contentType = context.req.header("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return {
        failure: {
          accepted: false,
          status: 400,
          code: "INGEST_CONTENT_TYPE",
          error: "La ingesta requiere Content-Type: application/json.",
        },
      };
    }
    const raw = await context.req.text();
    const parsed = this.service.parseBody(raw, this.maxBytes);
    if (isFailure(parsed)) return { failure: parsed };
    return { value: parsed };
  }

  private respond(context: Context, outcome: IngestOutcome) {
    if (outcome.accepted) return context.json(outcome, 202);
    return context.json(outcome, outcome.status as 400);
  }

  probe = async (context: Context) => {
    const input = await this.readJson(context);
    if ("failure" in input) return this.respond(context, input.failure);
    return this.respond(context, this.service.ingestProbe(input.value));
  };

  backup = async (context: Context) => {
    const input = await this.readJson(context);
    if ("failure" in input) return this.respond(context, input.failure);
    return this.respond(context, this.service.ingestBackup(input.value));
  };

  testRun = async (context: Context) => {
    const input = await this.readJson(context);
    if ("failure" in input) return this.respond(context, input.failure);
    return this.respond(context, this.service.ingestTestRun(input.value));
  };
}
