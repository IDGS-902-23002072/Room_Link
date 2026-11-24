import { and, desc, eq, or } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { connConnections } from "../../db/schema/social.js";
import {
  Connection,
  type ConnectionDirection,
  type IConnectionRepository,
} from "../../domain/index.js";

export class DrizzleConnectionRepository implements IConnectionRepository {
  constructor(private readonly db: MySql2Database<any>) {}

  async findById(id: string): Promise<Connection | null> {
    const rows = await this.db
      .select()
      .from(connConnections)
      .where(eq(connConnections.id, id))
      .limit(1);
    const row = rows[0];
    return row ? this.toDomain(row) : null;
  }

  async listForUser(
    userId: string,
    direction: ConnectionDirection,
  ): Promise<Connection[]> {
    const condition =
      direction === "incoming"
        ? eq(connConnections.addresseeId, userId)
        : direction === "outgoing"
          ? eq(connConnections.requesterId, userId)
          : or(
              eq(connConnections.addresseeId, userId),
              eq(connConnections.requesterId, userId),
            );
    const rows = await this.db
      .select()
      .from(connConnections)
      .where(condition)
      .orderBy(desc(connConnections.createdAt));
    return rows.map((row) => this.toDomain(row));
  }

  async update(connection: Connection): Promise<void> {
    // Al resolver (accept/reject/cancel), si ya no queda "activa" el par queda liberado.
    const stillActive = connection.status === "pending" || connection.status === "accepted";
    const pairLow = connection.requesterId.localeCompare(connection.addresseeId) < 0
      ? connection.requesterId
      : connection.addresseeId;
    const pairHigh = pairLow === connection.requesterId
      ? connection.addresseeId
      : connection.requesterId;

    await this.db
      .update(connConnections)
      .set({
        status: connection.status,
        introMessage: connection.introMessage,
        responseMessage: connection.responseMessage,
        respondedAt: connection.respondedAt,
        activePairLow: stillActive ? pairLow : null,
        activePairHigh: stillActive ? pairHigh : null,
      })
      .where(eq(connConnections.id, connection.id));
  }

  private toDomain(row: typeof connConnections.$inferSelect): Connection {
    return new Connection({
      id: row.id,
      requesterId: row.requesterId,
      addresseeId: row.addresseeId,
      status: row.status as Connection["status"],
      introMessage: row.introMessage ?? null,
      responseMessage: row.responseMessage ?? null,
      createdAt: new Date(row.createdAt),
      respondedAt: row.respondedAt ? new Date(row.respondedAt) : null,
    });
  }
}
