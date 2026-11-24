export const notificationTypes = [
  "application_status_changed",
  "connection_request",
  "connection_accepted",
  "new_message",
  "agreement_pending",
  "listing_moderated",
  "account_sanction",
  "system",
] as const;

export type NotificationType = (typeof notificationTypes)[number];

export interface NotificationProps {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string | null;
  payload: Record<string, unknown>;
  readAt: Date | null;
  emailSentAt: Date | null;
  createdAt: Date;
}

export class Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string | null;
  payload: Record<string, unknown>;
  readAt: Date | null;
  emailSentAt: Date | null;
  createdAt: Date;

  constructor(props: NotificationProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.type = props.type;
    this.title = props.title;
    this.body = props.body;
    this.payload = props.payload;
    this.readAt = props.readAt;
    this.emailSentAt = props.emailSentAt;
    this.createdAt = props.createdAt;
  }

  markRead(at: Date): void {
    if (!this.readAt) this.readAt = at;
  }

  isUnread(): boolean {
    return this.readAt === null;
  }
}

export interface NotificationPreference {
  userId: string;
  type: NotificationType;
  inApp: boolean;
  email: boolean;
}
