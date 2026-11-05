import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import { errorResponse } from "../../shared/AppError.js";
import type { AuthVariables } from "../auth/index.js";
import type { MessageEventPublisher } from "./messaging.ports.js";
import type { MessagingService } from "./messaging.service.js";

type AuthContext = Context<{ Variables: AuthVariables }>;

export class MessagingController {
  constructor(
    private readonly service: MessagingService,
    private readonly events: MessageEventPublisher,
  ) {}

  openRoom = async (context: AuthContext) =>
    this.handle(context, async () => {
      const body = await context.req.json();
      return context.json(
        await this.service.openRoom({
          userId: context.get("auth").userId,
          connectionId: body.connectionId,
          applicationId: body.applicationId,
        }),
        201,
      );
    });

  inbox = async (context: AuthContext) =>
    this.handle(context, async () =>
      context.json(await this.service.listInbox(context.get("auth").userId)),
    );

  messages = async (context: AuthContext) =>
    this.handle(context, async () => {
      const limit = Number(context.req.query("limit") ?? 50);
      const before = context.req.query("beforeId");
      return context.json(
        await this.service.listMessages(
          context.req.param("roomId")!,
          context.get("auth").userId,
          limit,
          before ? Number(before) : undefined,
        ),
      );
    });

  send = async (context: AuthContext) =>
    this.handle(context, async () => {
      const body = await context.req.json();
      return context.json(
        await this.service.sendMessage(
          context.req.param("roomId")!,
          context.get("auth").userId,
          body.body ?? "",
        ),
        201,
      );
    });

  delivered = async (context: AuthContext) =>
    this.handle(context, async () =>
      context.json({
        updated: await this.service.markDelivered(
          context.req.param("roomId")!,
          context.get("auth").userId,
        ),
      }),
    );

  read = async (context: AuthContext) =>
    this.handle(context, async () =>
      context.json({
        updated: await this.service.markRead(
          context.req.param("roomId")!,
          context.get("auth").userId,
        ),
      }),
    );

  context = async (context: AuthContext) =>
    this.handle(context, async () =>
      context.json(
        await this.service.getContext(
          context.req.param("roomId")!,
          context.get("auth").userId,
        ),
      ),
    );

  eventsStream = async (context: AuthContext) => {
    try {
      const roomId = context.req.param("roomId")!;
      await this.service.assertMember(roomId, context.get("auth").userId);
      return streamSSE(context, async (stream) => {
        let closed = false;
        const unsubscribe = this.events.subscribe(roomId, (event) => {
          if (!closed) void stream.writeSSE({ event: event.type, data: JSON.stringify(event) });
        });
        stream.onAbort(() => {
          closed = true;
          unsubscribe();
        });
        await stream.writeSSE({ event: "connected", data: JSON.stringify({ roomId }) });
        while (!closed) await stream.sleep(15_000);
      });
    } catch (error) {
      return this.failure(context, error);
    }
  };

  private async handle(context: AuthContext, operation: () => Promise<Response>): Promise<Response> {
    try {
      return await operation();
    } catch (error) {
      return this.failure(context, error);
    }
  }

  private failure(context: AuthContext, error: unknown): Response {
    const response = errorResponse(error);
    return context.json({ error: response.error, code: response.code }, response.status as 400);
  }
}
