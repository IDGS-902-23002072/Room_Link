import type {
  Notification,
  NotificationPreference,
  NotificationType,
} from "../entities/Notification.js";

export interface ListNotificationsFilter {
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}

export interface INotificationRepository {
  list(userId: string, filter?: ListNotificationsFilter): Promise<Notification[]>;
  countUnread(userId: string): Promise<number>;
  findById(id: string): Promise<Notification | null>;
  create(notification: Notification): Promise<Notification>;
  markRead(id: string, at: Date): Promise<void>;
  markAllRead(userId: string, at: Date): Promise<number>;
  getPreferences(userId: string): Promise<NotificationPreference[]>;
  upsertPreference(preference: NotificationPreference): Promise<NotificationPreference>;
  getPreferenceFor(userId: string, type: NotificationType): Promise<NotificationPreference | null>;
}
