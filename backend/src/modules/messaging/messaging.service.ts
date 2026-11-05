import { AppError } from "../../shared/AppError.js";
import type {
  ChatContext,
  ChatInboxItem,
  ChatMessageRecord,
  ChatRoomRecord,
  MessageEventPublisher,
  MessagingRepository,
} from "./messaging.ports.js";

export class MessagingService {
  constructor(
    private readonly repository: MessagingRepository,
    private readonly events: MessageEventPublisher,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async openRoom(input: {
    userId: string;
    connectionId?: string;
    applicationId?: string;
  }): Promise<ChatRoomRecord> {
    if (Boolean(input.connectionId) === Boolean(input.applicationId)) {
      throw new AppError(
        "Indica exactamente una conexión o postulación aceptada.",
        400,
        "CHAT_ORIGIN_REQUIRED",
      );
    }
    return this.repository.openAuthorizedRoom(input);
  }

  listInbox(userId: string): Promise<ChatInboxItem[]> {
    return this.repository.listInbox(userId);
  }

  async listMessages(
    roomId: string,
    userId: string,
    limit = 50,
    beforeId?: number,
  ): Promise<ChatMessageRecord[]> {
    this.assertLimit(limit);
    await this.assertMember(roomId, userId);
    return this.repository.listMessages({ roomId, userId, limit, beforeId });
  }

  async sendMessage(roomId: string, senderId: string, bodyInput: string): Promise<ChatMessageRecord> {
    await this.assertMember(roomId, senderId);
    const body = bodyInput.trim();
    if (body.length < 1 || body.length > 4000) {
      throw new AppError(
        "El mensaje debe contener entre 1 y 4000 caracteres.",
        400,
        "INVALID_MESSAGE_BODY",
      );
    }
    const message = await this.repository.createMessage({
      roomId,
      senderId,
      body,
      sentAt: this.now(),
    });
    this.events.publish(roomId, { type: "message.created", message });
    return message;
  }

  async markDelivered(roomId: string, recipientId: string): Promise<number> {
    await this.assertMember(roomId, recipientId);
    const at = this.now();
    const count = await this.repository.markDelivered(roomId, recipientId, at);
    this.events.publish(roomId, {
      type: "message.delivered",
      roomId,
      recipientId,
      at: at.toISOString(),
    });
    return count;
  }

  async markRead(roomId: string, readerId: string): Promise<number> {
    await this.assertMember(roomId, readerId);
    const at = this.now();
    const count = await this.repository.markRead(roomId, readerId, at);
    this.events.publish(roomId, {
      type: "message.read",
      roomId,
      readerId,
      at: at.toISOString(),
    });
    return count;
  }

  async getContext(roomId: string, userId: string): Promise<ChatContext> {
    await this.assertMember(roomId, userId);
    return this.repository.getContext(roomId, userId);
  }

  async assertMember(roomId: string, userId: string): Promise<void> {
    if (!(await this.repository.isMember(roomId, userId))) {
      throw new AppError("No tienes acceso a esta conversación.", 403, "CHAT_ACCESS_DENIED");
    }
  }

  private assertLimit(limit: number): void {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new AppError("El límite debe estar entre 1 y 100.", 400, "INVALID_LIMIT");
    }
  }
}
