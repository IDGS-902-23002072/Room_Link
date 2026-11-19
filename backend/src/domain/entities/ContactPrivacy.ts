export interface ContactPrivacyProps {
  userId: string;
  showPhoneToConnections: boolean;
  showEmailToConnections: boolean;
  showSocialsToConnections: boolean;
}

export class ContactPrivacy {
  private props: ContactPrivacyProps;

  constructor(props: ContactPrivacyProps) {
    this.props = { ...props };
  }

  get userId(): string {
    return this.props.userId;
  }

  get showPhoneToConnections(): boolean {
    return this.props.showPhoneToConnections;
  }

  get showEmailToConnections(): boolean {
    return this.props.showEmailToConnections;
  }

  get showSocialsToConnections(): boolean {
    return this.props.showSocialsToConnections;
  }

  public update(settings: {
    showPhoneToConnections?: boolean;
    showEmailToConnections?: boolean;
    showSocialsToConnections?: boolean;
  }): void {
    if (settings.showPhoneToConnections !== undefined) {
      this.props.showPhoneToConnections = settings.showPhoneToConnections;
    }
    if (settings.showEmailToConnections !== undefined) {
      this.props.showEmailToConnections = settings.showEmailToConnections;
    }
    if (settings.showSocialsToConnections !== undefined) {
      this.props.showSocialsToConnections = settings.showSocialsToConnections;
    }
  }

  public toJSON(): Record<string, unknown> {
    return {
      userId: this.props.userId,
      showPhoneToConnections: this.props.showPhoneToConnections,
      showEmailToConnections: this.props.showEmailToConnections,
      showSocialsToConnections: this.props.showSocialsToConnections,
    };
  }

  public static defaultsFor(userId: string): ContactPrivacy {
    return new ContactPrivacy({
      userId,
      showPhoneToConnections: true,
      showEmailToConnections: true,
      showSocialsToConnections: true,
    });
  }
}
