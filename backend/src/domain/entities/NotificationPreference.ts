export const notificationTypeValues = [
  "application_status_changed",
  "connection_request",
  "connection_accepted",
  "new_message",
  "agreement_pending",
  "listing_moderated",
  "account_sanction",
  "system",
] as const;

export type NotificationType = (typeof notificationTypeValues)[number];

export interface NotificationPreferenceProps {
  userId: string;
  type: NotificationType;
  inApp: boolean;
  email: boolean;
}

export class NotificationPreference {
  private props: NotificationPreferenceProps;

  constructor(props: NotificationPreferenceProps) {
    if (!notificationTypeValues.includes(props.type)) {
      throw new Error(`Tipo de notificación inválido: ${props.type}`);
    }
    this.props = { ...props };
  }

  get userId(): string {
    return this.props.userId;
  }

  get type(): NotificationType {
    return this.props.type;
  }

  get inApp(): boolean {
    return this.props.inApp;
  }

  get email(): boolean {
    return this.props.email;
  }

  public setChannels(channels: { inApp?: boolean; email?: boolean }): void {
    if (channels.inApp !== undefined) this.props.inApp = channels.inApp;
    if (channels.email !== undefined) this.props.email = channels.email;
  }

  public toJSON(): Record<string, unknown> {
    return {
      userId: this.props.userId,
      type: this.props.type,
      inApp: this.props.inApp,
      email: this.props.email,
    };
  }
}
