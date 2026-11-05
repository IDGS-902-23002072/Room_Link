export interface ChatRoomRecord {
  id: string;
  connectionId?: string | null | undefined;
  applicationId?: string | null | undefined;
  memberIds: string[];
  createdAt: Date;
}

export interface ChatMessageRecord {
  id: number;
  roomId: string;
  senderId: string;
  body: string;
  sentAt: Date;
  deliveredAt?: Date | null;
  readAt?: Date | null;
}

export interface ChatInboxItem {
  room: ChatRoomRecord;
  counterpartId: string | null;
  lastMessage: ChatMessageRecord | null;
  unreadCount: number;
}

export interface ChatContext {
  roomId: string;
  counterpartId: string | null;
  connectionId?: string | null | undefined;
  applicationId?: string | null | undefined;
  listingId?: string | null | undefined;
}

export interface MessagingRepository {
  openAuthorizedRoom(input: {
    userId: string;
    connectionId?: string;
    applicationId?: string;
  }): Promise<ChatRoomRecord>;
  isMember(roomId: string, userId: string): Promise<boolean>;
  listInbox(userId: string): Promise<ChatInboxItem[]>;
  listMessages(input: {
    roomId: string;
    userId: string;
    limit: number;
    beforeId?: number | undefined;
  }): Promise<ChatMessageRecord[]>;
  createMessage(input: {
    roomId: string;
    senderId: string;
    body: string;
    sentAt: Date;
  }): Promise<ChatMessageRecord>;
  markDelivered(roomId: string, recipientId: string, at: Date): Promise<number>;
  markRead(roomId: string, readerId: string, at: Date): Promise<number>;
  getContext(roomId: string, userId: string): Promise<ChatContext>;
}

export type MessageEvent =
  | { type: "message.created"; message: ChatMessageRecord }
  | { type: "message.delivered"; roomId: string; recipientId: string; at: string }
  | { type: "message.read"; roomId: string; readerId: string; at: string };

export interface MessageEventPublisher {
  publish(roomId: string, event: MessageEvent): void;
  subscribe(roomId: string, listener: (event: MessageEvent) => void): () => void;
}
