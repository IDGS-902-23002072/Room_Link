import type {
  Connection,
  ConnectionDirection,
  IConnectionRepository,
} from "../../domain/index.js";
import { AppError } from "../../shared/AppError.js";
import type { DomainEventPublisher } from "../auth/index.js";

export type ConnectionDecision = "accept" | "reject";

export interface RespondInput {
  connectionId: string;
  userId: string;
  decision: ConnectionDecision;
  responseMessage?: string | null;
}

export class ConnectionsService {
  constructor(
    private readonly repo: IConnectionRepository,
    private readonly events: DomainEventPublisher,
    private readonly now: () => Date = () => new Date(),
  ) {}

  listForUser(userId: string, direction: ConnectionDirection): Promise<Connection[]> {
    return this.repo.listForUser(userId, direction);
  }

  async respond(input: RespondInput): Promise<Connection> {
    const connection = await this.repo.findById(input.connectionId);
    if (!connection) {
      throw new AppError("Conexión no encontrada.", 404, "CONNECTION_NOT_FOUND");
    }
    if (!connection.isAddressee(input.userId)) {
      throw new AppError(
        "Solo el destinatario puede responder esta solicitud.",
        403,
        "CONNECTION_FORBIDDEN",
      );
    }
    if (connection.status !== "pending") {
      throw new AppError(
        `La conexión ya fue resuelta (${connection.status}).`,
        409,
        "CONNECTION_ALREADY_RESOLVED",
      );
    }

    const message = input.responseMessage?.trim() || null;
    if (message && message.length > 500) {
      throw new AppError(
        "El mensaje de respuesta no puede superar 500 caracteres.",
        400,
        "CONNECTION_MESSAGE_TOO_LONG",
      );
    }

    const at = this.now();
    if (input.decision === "accept") {
      connection.accept(at, message);
    } else {
      connection.reject(at, message);
    }
    await this.repo.update(connection);

    if (input.decision === "accept") {
      await this.events.publish({
        type: "ConnectionAcceptedEvent",
        aggregateId: connection.id,
        payload: {
          connectionId: connection.id,
          requesterId: connection.requesterId,
          addresseeId: connection.addresseeId,
        },
      });
    }
    return connection;
  }

  async cancel(connectionId: string, userId: string): Promise<Connection> {
    const connection = await this.repo.findById(connectionId);
    if (!connection) {
      throw new AppError("Conexión no encontrada.", 404, "CONNECTION_NOT_FOUND");
    }
    if (!connection.isRequester(userId)) {
      throw new AppError(
        "Solo el solicitante puede cancelar esta solicitud.",
        403,
        "CONNECTION_FORBIDDEN",
      );
    }
    if (connection.status !== "pending") {
      throw new AppError(
        `La conexión ya fue resuelta (${connection.status}).`,
        409,
        "CONNECTION_ALREADY_RESOLVED",
      );
    }
    connection.cancel(this.now());
    await this.repo.update(connection);
    return connection;
  }
}
