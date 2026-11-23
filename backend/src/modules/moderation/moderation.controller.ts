import type { Context } from "hono";
import { errorResponse } from "../../shared/AppError.js";
import type { AuthVariables } from "../auth/index.js";
import type {
  ListingReportReason,
  ListingReviewStatus,
  ReportReason,
  ReportStatus,
  ReportTargetType,
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

  reportUser = async (context: AuthContext) =>
    this.handle(context, async () => {
      const body = await context.req.json();
      return context.json(
        await this.service.reportUser({
          reporterId: context.get("auth").userId,
          targetUserId: context.req.param("userId")!,
          reason: body.reason as ReportReason,
          description: body.description,
        }),
        201,
      );
    });

  reportMessage = async (context: AuthContext) =>
    this.handle(context, async () => {
      const body = await context.req.json();
      const rawMessageId = context.req.param("messageId");
      const messageId = rawMessageId ? Number(rawMessageId) : NaN;
      return context.json(
        await this.service.reportMessage({
          reporterId: context.get("auth").userId,
          targetMessageId: messageId,
          reason: body.reason as ReportReason,
          description: body.description,
        }),
        201,
      );
    });

  allReports = async (context: AuthContext) =>
    this.handle(context, async () => {
      const targetType = context.req.query("targetType") as ReportTargetType | undefined;
      const status = context.req.query("status") as ReportStatus | undefined;
      const filter: { targetType?: ReportTargetType; status?: ReportStatus } = {};
      if (targetType) filter.targetType = targetType;
      if (status) filter.status = status;
      return context.json(await this.service.listAllReports(filter));
    });

  resolveReport = async (context: AuthContext) =>
    this.handle(context, async () => {
      const body = await context.req.json();
      return context.json(
        await this.service.resolveReport({
          reportId: context.req.param("id")!,
          status: body.status,
        }),
      );
    });

  private async handle(context: AuthContext, operation: () => Promise<Response>): Promise<Response> {
    try {
      return await operation();
    } catch (error) {
      const response = errorResponse(error);
      return context.json({ error: response.error, code: response.code }, response.status as 400);
    }
  }
}
