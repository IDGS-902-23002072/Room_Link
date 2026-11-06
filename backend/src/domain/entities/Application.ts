import type { ApplicationStatus } from "./User.js";

export interface ApplicationProps {
  id: string;
  listingId: string;
  applicantId: string;
  status?: ApplicationStatus | undefined;
  message?: string | null | undefined;
  compatibilityScore?: number | null | undefined;
  createdAt: Date;
  decidedAt?: Date | null | undefined;
}

export class Application {
  private props: ApplicationProps;

  constructor(props: ApplicationProps) {
    this.props = {
      ...props,
      status: props.status ?? "pending",
    };
  }

  get id(): string {
    return this.props.id;
  }

  get listingId(): string {
    return this.props.listingId;
  }

  get applicantId(): string {
    return this.props.applicantId;
  }

  get status(): ApplicationStatus {
    return this.props.status ?? "pending";
  }

  get message(): string | null | undefined {
    return this.props.message;
  }

  get compatibilityScore(): number | null | undefined {
    return this.props.compatibilityScore;
  }

  public accept(): void {
    if (this.props.status !== "pending" && this.props.status !== "waitlisted") {
      throw new Error(`No se puede aceptar una solicitud en estado '${this.props.status}'`);
    }
    this.props.status = "accepted";
    this.props.decidedAt = new Date();
  }

  public reject(): void {
    if (this.props.status !== "pending" && this.props.status !== "waitlisted") {
      throw new Error(`No se puede rechazar una solicitud en estado '${this.props.status}'`);
    }
    this.props.status = "rejected";
    this.props.decidedAt = new Date();
  }

  public toJSON(): Record<string, unknown> {
    return {
      id: this.props.id,
      listingId: this.props.listingId,
      applicantId: this.props.applicantId,
      status: this.props.status,
      message: this.props.message,
      compatibilityScore: this.props.compatibilityScore,
      createdAt: this.props.createdAt.toISOString(),
      decidedAt: this.props.decidedAt ? this.props.decidedAt.toISOString() : null,
    };
  }
}
