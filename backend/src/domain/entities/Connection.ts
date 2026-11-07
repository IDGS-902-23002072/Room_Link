export type ConnectionStatus = "pending" | "accepted" | "rejected" | "cancelled";

export interface ConnectionProps {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: ConnectionStatus;
  introMessage: string | null;
  responseMessage: string | null;
  createdAt: Date;
  respondedAt: Date | null;
}

export class Connection {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: ConnectionStatus;
  introMessage: string | null;
  responseMessage: string | null;
  createdAt: Date;
  respondedAt: Date | null;

  constructor(props: ConnectionProps) {
    if (props.requesterId === props.addresseeId) {
      throw new Error("Requester y addressee no pueden ser el mismo usuario.");
    }
    this.id = props.id;
    this.requesterId = props.requesterId;
    this.addresseeId = props.addresseeId;
    this.status = props.status;
    this.introMessage = props.introMessage;
    this.responseMessage = props.responseMessage;
    this.createdAt = props.createdAt;
    this.respondedAt = props.respondedAt;
  }

  accept(at: Date, message: string | null = null): void {
    this.assertRespondable();
    this.status = "accepted";
    this.respondedAt = at;
    this.responseMessage = message;
  }

  reject(at: Date, message: string | null = null): void {
    this.assertRespondable();
    this.status = "rejected";
    this.respondedAt = at;
    this.responseMessage = message;
  }

  cancel(at: Date): void {
    this.assertRespondable();
    this.status = "cancelled";
    this.respondedAt = at;
  }

  isAddressee(userId: string): boolean {
    return this.addresseeId === userId;
  }

  isRequester(userId: string): boolean {
    return this.requesterId === userId;
  }

  private assertRespondable(): void {
    if (this.status !== "pending") {
      throw new Error(`La conexión ya fue resuelta (${this.status}).`);
    }
  }
}
