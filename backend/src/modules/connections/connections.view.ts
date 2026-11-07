import type { Connection } from "../../domain/index.js";

export interface ConnectionDTO {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: Connection["status"];
  introMessage: string | null;
  responseMessage: string | null;
  createdAt: string;
  respondedAt: string | null;
}

export class ConnectionView {
  static toDTO(connection: Connection): ConnectionDTO {
    return {
      id: connection.id,
      requesterId: connection.requesterId,
      addresseeId: connection.addresseeId,
      status: connection.status,
      introMessage: connection.introMessage,
      responseMessage: connection.responseMessage,
      createdAt: connection.createdAt.toISOString(),
      respondedAt: connection.respondedAt ? connection.respondedAt.toISOString() : null,
    };
  }

  static toList(connections: Connection[]): ConnectionDTO[] {
    return connections.map((c) => ConnectionView.toDTO(c));
  }
}
