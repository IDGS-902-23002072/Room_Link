import {
  Connection,
  type ConnectionDirection,
  type IConnectionRepository,
} from "../../domain/index.js";
import { AppError } from "../../shared/AppError.js";
import type { DomainEventPublisher } from "../auth/index.js";
import { randomUUID } from "node:crypto";

export type ConnectionDecision = "accept" | "reject";

export interface RespondInput {
  connectionId: string;
  userId: string;
  decision: ConnectionDecision;
  responseMessage?: string | null;
}

export interface SendConnectionInput {
  requesterId: string;
  addresseeId: string;
  introMessage?: string | null;
}

export class ConnectionsService {
  constructor(
    private readonly repo: IConnectionRepository,
    private readonly events: DomainEventPublisher,
    private readonly now: () => Date = () => new Date(),
  ) { }

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

  async send(input: SendConnectionInput): Promise<Connection> {
    // 1. Validar que no se envíe una solicitud a sí mismo.
    if (input.requesterId === input.addresseeId) {
      throw new AppError(
        "No puedes enviarte una solicitud a ti mismo.",
        400,
        "CONNECTION_SELF_REQUEST",
      );
    }

    // 2. Validar el mensaje opcional.
    const message = input.introMessage?.trim() || null;

    if (message && message.length > 500) {
      throw new AppError(
        "El mensaje no puede superar los 500 caracteres.",
        400,
        "CONNECTION_MESSAGE_TOO_LONG",
      );
    }

    // 3. Comprobar si ya existe una solicitud o conexión activa.
    const exists = await this.repo.existsActiveBetween(
      input.requesterId,
      input.addresseeId,
    );

    if (exists) {
      throw new AppError(
        "Ya existe una solicitud pendiente o una conexión aceptada entre estos usuarios.",
        409,
        "CONNECTION_ALREADY_EXISTS",
      );
    }

    // 4. Crear la nueva conexión.
    const connection = new Connection({
      id: randomUUID(),
      requesterId: input.requesterId,
      addresseeId: input.addresseeId,
      status: "pending",
      introMessage: message,
      responseMessage: null,
      createdAt: this.now(),
      respondedAt: null,
    });

    // 5. Guardar en la base de datos.
    try {
      await this.repo.create(connection);
    } catch (error) {
      // El índice único también protege contra solicitudes simultáneas.
      type DatabaseError = { code?: string; errno?: number };
      const dbError = error as DatabaseError & { cause?: DatabaseError };
      const cause = dbError?.cause ?? dbError;
      if (cause?.code === "ER_DUP_ENTRY" || cause?.errno === 1062) {
        throw new AppError(
          "Ya existe una solicitud pendiente o una conexión aceptada entre estos usuarios.",
          409,
          "CONNECTION_ALREADY_EXISTS",
        );
      }

      if (cause?.code === "ER_NO_REFERENCED_ROW_2" || cause?.errno === 1452) {
        throw new AppError("No se encontró al destinatario.", 404, "CONNECTION_ADDRESSEE_NOT_FOUND");
      }
      throw error;
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
