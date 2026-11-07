import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  notifNotifications,
  notifPreferences,
  type NotifNotificationRow,
  type NotifPreferenceRow,
} from "../../db/schema/governance.js";
import {
  Notification,
  type INotificationRepository,
  type ListNotificationsFilter,
  type NotificationPreference,
  type NotificationType,
} from "../../domain/index.js";

export class DrizzleNotificationRepository implements INotificationRepository {
  constructor(private readonly db: MySql2Database<any>) {}

  async list(userId: string, filter: ListNotificationsFilter = {}): Promise<Notification[]> {
    const limit = filter.limit ?? 25;
    const offset = filter.offset ?? 0;
    const conditions = filter.unreadOnly
      ? and(eq(notifNotifications.userId, userId), isNull(notifNotifications.readAt))
      : eq(notifNotifications.userId, userId);
    const rows = await this.db
      .select()
      .from(notifNotifications)
      .where(conditions)
      .orderBy(desc(notifNotifications.createdAt))
      .limit(limit)
      .offset(offset);
    return rows.map((row) => this.toDomain(row));
  }

  async countUnread(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ value: sql<number>`count(*)` })
      .from(notifNotifications)
      .where(
        and(eq(notifNotifications.userId, userId), isNull(notifNotifications.readAt)),
      );
    return Number(row?.value ?? 0);
  }

  async findById(id: string): Promise<Notification | null> {
    const rows = await this.db
      .select()
      .from(notifNotifications)
      .where(eq(notifNotifications.id, id))
      .limit(1);
    const row = rows[0];
    return row ? this.toDomain(row) : null;
  }

  async create(notification: Notification): Promise<Notification> {
    await this.db.insert(notifNotifications).values({
      id: notification.id,
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      payload: notification.payload,
      readAt: notification.readAt,
      emailSentAt: notification.emailSentAt,
      createdAt: notification.createdAt,
    });
    return notification;
  }

  async markRead(id: string, at: Date): Promise<void> {
    await this.db
      .update(notifNotifications)
      .set({ readAt: at })
      .where(eq(notifNotifications.id, id));
  }

  async markAllRead(userId: string, at: Date): Promise<number> {
    const result = await this.db
      .update(notifNotifications)
      .set({ readAt: at })
      .where(
        and(eq(notifNotifications.userId, userId), isNull(notifNotifications.readAt)),
      );
    return (result as any)?.rowsAffected ?? (result as any)?.[0]?.affectedRows ?? 0;
  }

  async getPreferences(userId: string): Promise<NotificationPreference[]> {
    const rows = await this.db
      .select()
      .from(notifPreferences)
      .where(eq(notifPreferences.userId, userId));
    return rows.map((row) => this.toPreference(row));
  }

  async getPreferenceFor(
    userId: string,
    type: NotificationType,
  ): Promise<NotificationPreference | null> {
    const rows = await this.db
      .select()
      .from(notifPreferences)
      .where(and(eq(notifPreferences.userId, userId), eq(notifPreferences.type, type)))
      .limit(1);
    const row = rows[0];
    return row ? this.toPreference(row) : null;
  }

  async upsertPreference(preference: NotificationPreference): Promise<NotificationPreference> {
    const existing = await this.getPreferenceFor(preference.userId, preference.type);
    if (existing) {
      await this.db
        .update(notifPreferences)
        .set({ inApp: preference.inApp, email: preference.email })
        .where(
          and(
            eq(notifPreferences.userId, preference.userId),
            eq(notifPreferences.type, preference.type),
          ),
        );
    } else {
      await this.db.insert(notifPreferences).values({
        userId: preference.userId,
        type: preference.type,
        inApp: preference.inApp,
        email: preference.email,
      });
    }
    return preference;
  }

  private toDomain(row: NotifNotificationRow): Notification {
    return new Notification({
      id: row.id,
      userId: row.userId,
      type: row.type as NotificationType,
      title: row.title,
      body: row.body ?? null,
      payload: (row.payload ?? {}) as Record<string, unknown>,
      readAt: row.readAt ? new Date(row.readAt) : null,
      emailSentAt: row.emailSentAt ? new Date(row.emailSentAt) : null,
      createdAt: new Date(row.createdAt),
    });
  }

  private toPreference(row: NotifPreferenceRow): NotificationPreference {
    return {
      userId: row.userId,
      type: row.type as NotificationType,
      inApp: Boolean(row.inApp),
      email: Boolean(row.email),
    };
  }
}
