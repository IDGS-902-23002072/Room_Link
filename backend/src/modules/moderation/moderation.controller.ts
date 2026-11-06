import type { Context } from "hono";
import { errorResponse } from "../../shared/AppError.js";
import type { AuthVariables } from "../auth/index.js";
import type {
  ListingReportReason,
  ListingReviewStatus,
  ReportStatus,
} from "./moderation.ports.js";
import type { ModerationService } from "./moderation.service.js";

type AuthContext = Context<{ Variables: AuthVariables }>;

export class ModerationController {
  constructor(private readonly service: ModerationService) {}

  reportListing = async (context: AuthContext) =>
    this.handle(context, async () => {
      const body = await context.req.json();
      return context.json(
        await this.service.reportListing({
          reporterId: context.get("auth").userId,
          listingId: context.req.param("listingId")!,
          reason: body.reason as ListingReportReason,
          description: body.description,
        }),
        201,
      );
    });

  reports = async (context: AuthContext) =>
    this.handle(context, async () =>
      context.json(await this.service.listReports(context.req.query("status") as ReportStatus)),
    );

  enqueue = async (context: AuthContext) =>
    this.handle(context, async () =>
      context.json(await this.service.enqueueListing(context.req.param("listingId")!), 201),
    );

  queue = async (context: AuthContext) =>
    this.handle(context, async () =>
      context.json(
        await this.service.listQueue(
          (context.req.query("status") as ListingReviewStatus | undefined) ?? "pending",
        ),
      ),
    );

  decide = async (context: AuthContext) =>
    this.handle(context, async () => {
      const body = await context.req.json();
      return context.json(
        await this.service.decideListing({
          listingId: context.req.param("listingId")!,
          reviewerId: context.get("auth").userId,
          decision: body.decision,
          reason: body.reason,
        }),
      );
    });

  history = async (context: AuthContext) =>
    this.handle(context, async () => context.json(await this.service.listHistory()));

  private async handle(context: AuthContext, operation: () => Promise<Response>): Promise<Response> {
    try {
      return await operation();
    } catch (error) {
      const response = errorResponse(error);
      return context.json({ error: response.error, code: response.code }, response.status as 400);
    }
  }
}
