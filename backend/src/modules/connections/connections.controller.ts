import type { Context } from "hono";
import { errorResponse } from "../../shared/AppError.js";
import type { ConnectionDirection } from "../../domain/index.js";
import type { AuthVariables } from "../auth/index.js";
import type { ConnectionsService } from "./connections.service.js";
import { ConnectionView } from "./connections.view.js";

type AuthContext = Context<{ Variables: AuthVariables }>;

export class ConnectionsController {
  constructor(private readonly service: ConnectionsService) {}

  list = async (c: AuthContext) =>
    this.handle(c, async () => {
      const rawDirection = (c.req.query("direction") ?? "all") as ConnectionDirection;
      const direction: ConnectionDirection =
        rawDirection === "incoming" || rawDirection === "outgoing" ? rawDirection : "all";
      const list = await this.service.listForUser(c.get("auth").userId, direction);
      return c.json(ConnectionView.toList(list));
    });

  respond = async (c: AuthContext) =>
    this.handle(c, async () => {
      const body = await c.req.json();
      if (body.decision !== "accept" && body.decision !== "reject") {
        return c.json({ error: "decision debe ser 'accept' o 'reject'" }, 400);
      }
      const connection = await this.service.respond({
        connectionId: c.req.param("id")!,
        userId: c.get("auth").userId,
        decision: body.decision,
        responseMessage: body.responseMessage ?? null,
      });
      return c.json(ConnectionView.toDTO(connection));
    });

  cancel = async (c: AuthContext) =>
    this.handle(c, async () => {
      const connection = await this.service.cancel(c.req.param("id")!, c.get("auth").userId);
      return c.json(ConnectionView.toDTO(connection));
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
