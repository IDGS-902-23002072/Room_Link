import type { Context } from "hono";
import { errorResponse } from "../../shared/AppError.js";
import type { NotificationType } from "../../domain/index.js";
import type { AuthVariables } from "../auth/index.js";
import type { NotificationsService } from "./notifications.service.js";
import { NotificationView } from "./notifications.view.js";

type AuthContext = Context<{ Variables: AuthVariables }>;

export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  list = async (c: AuthContext) =>
    this.handle(c, async () => {
      const userId = c.get("auth").userId;
      const unreadOnly = c.req.query("unreadOnly") === "true";
      const limitRaw = Number(c.req.query("limit") ?? 25);
      const offsetRaw = Number(c.req.query("offset") ?? 0);
      const limit = Number.isInteger(limitRaw) && limitRaw > 0 && limitRaw <= 100 ? limitRaw : 25;
      const offset = Number.isInteger(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;
      const [items, unreadCount] = await Promise.all([
        this.service.list(userId, { unreadOnly, limit, offset }),
        this.service.countUnread(userId),
      ]);
      return c.json({ items: NotificationView.toList(items), unreadCount });
    });

  markRead = async (c: AuthContext) =>
    this.handle(c, async () => {
      await this.service.markRead(c.req.param("id")!, c.get("auth").userId);
      return c.json({ ok: true });
    });

  markAllRead = async (c: AuthContext) =>
    this.handle(c, async () => {
      const updated = await this.service.markAllRead(c.get("auth").userId);
      return c.json({ updated });
    });

  getPreferences = async (c: AuthContext) =>
    this.handle(c, async () =>
      c.json({ preferences: await this.service.getPreferences(c.get("auth").userId) }),
    );

  updatePreferences = async (c: AuthContext) =>
    this.handle(c, async () => {
      const body = await c.req.json();
      if (!Array.isArray(body?.preferences)) {
        return c.json({ error: "preferences debe ser un arreglo." }, 400);
      }
      const userId = c.get("auth").userId;
      const result = [];
      for (const raw of body.preferences) {
        if (
          !raw ||
          typeof raw.type !== "string" ||
          typeof raw.inApp !== "boolean" ||
          typeof raw.email !== "boolean"
        ) {
          return c.json({ error: "Cada preferencia requiere type, inApp y email." }, 400);
        }
        const updated = await this.service.updatePreference({
          userId,
          type: raw.type as NotificationType,
          inApp: raw.inApp,
          email: raw.email,
        });
        result.push(updated);
      }
      return c.json({ preferences: result });
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
