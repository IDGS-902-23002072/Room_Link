import { randomUUID } from "node:crypto";
import {
  Notification,
  notificationTypes,
  type INotificationRepository,
  type ListNotificationsFilter,
  type NotificationPreference,
  type NotificationType,
} from "../../domain/index.js";
import { AppError } from "../../shared/AppError.js";

export class NotificationsService {
  constructor(
    private readonly repo: INotificationRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  list(userId: string, filter: ListNotificationsFilter = {}) {
    return this.repo.list(userId, filter);
  }

  countUnread(userId: string) {
    return this.repo.countUnread(userId);
  }

  async markRead(id: string, userId: string): Promise<void> {
    const notification = await this.repo.findById(id);
    if (!notification) {
      throw new AppError("Notificación no encontrada.", 404, "NOTIFICATION_NOT_FOUND");
    }
    if (notification.userId !== userId) {
      throw new AppError("No autorizado.", 403, "FORBIDDEN");
    }
    if (notification.isUnread()) {
      await this.repo.markRead(id, this.now());
    }
  }

  async markAllRead(userId: string): Promise<number> {
    return this.repo.markAllRead(userId, this.now());
  }

  async getPreferences(userId: string): Promise<NotificationPreference[]> {
    const stored = await this.repo.getPreferences(userId);
    const map = new Map(stored.map((p) => [p.type, p]));
    // Completa con defaults (in-app y email activos) para tipos sin entrada.
    return notificationTypes.map(
      (type) =>
        map.get(type) ?? { userId, type, inApp: true, email: true },
    );
  }

  async updatePreference(input: NotificationPreference): Promise<NotificationPreference> {
    if (!notificationTypes.includes(input.type)) {
      throw new AppError("Tipo de notificación inválido.", 400, "INVALID_NOTIFICATION_TYPE");
    }
    return this.repo.upsertPreference(input);
  }

  /**
   * Crea una notificación respetando la preferencia `inApp` del usuario.
   * Devuelve `null` si la preferencia bloquea la entrega in-app.
   */
  async createIfAllowed(input: {
    userId: string;
    type: NotificationType;
    title: string;
    body?: string | null;
    payload?: Record<string, unknown>;
  }): Promise<Notification | null> {
    const preference = await this.repo.getPreferenceFor(input.userId, input.type);
    const inAppAllowed = preference ? preference.inApp : true;
    if (!inAppAllowed) return null;

    const notification = new Notification({
      id: randomUUID(),
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      payload: input.payload ?? {},
      readAt: null,
      emailSentAt: null,
      createdAt: this.now(),
    });
    return this.repo.create(notification);
  }
}
