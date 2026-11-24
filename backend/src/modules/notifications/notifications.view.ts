import type { Notification, NotificationPreference } from "../../domain/index.js";

export interface NotificationDTO {
  id: string;
  userId: string;
  type: Notification["type"];
  title: string;
  body: string | null;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export class NotificationView {
  static toDTO(n: Notification): NotificationDTO {
    return {
      id: n.id,
      userId: n.userId,
      type: n.type,
      title: n.title,
      body: n.body,
      payload: n.payload,
      readAt: n.readAt ? n.readAt.toISOString() : null,
      createdAt: n.createdAt.toISOString(),
    };
  }

  static toList(items: Notification[]): NotificationDTO[] {
    return items.map((n) => NotificationView.toDTO(n));
  }

  static preferencesToDTO(prefs: NotificationPreference[]): NotificationPreference[] {
    return prefs;
  }
}
