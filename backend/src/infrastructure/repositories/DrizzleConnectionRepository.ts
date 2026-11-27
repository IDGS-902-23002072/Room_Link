import { and, desc, eq, or } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { connConnections } from "../../db/schema/social.js";
import {
  Connection,
  type ConnectionDirection,
  type IConnectionRepository,
} from "../../domain/index.js";

export class DrizzleConnectionRepository implements IConnectionRepository {
  constructor(private readonly db: MySql2Database<any>) { }

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
    const stillActive =
      connection.status === "pending" ||
      connection.status === "accepted";

    const [pairLow, pairHigh] = this.getPair(
      connection.requesterId,
      connection.addresseeId,
    );

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

  async create(connection: Connection): Promise<void> {
    const [pairLow, pairHigh] = this.getPair(
      connection.requesterId,
      connection.addresseeId,
    );

    await this.db.insert(connConnections).values({
      id: connection.id,
      requesterId: connection.requesterId,
      addresseeId: connection.addresseeId,
      status: connection.status,
      introMessage: connection.introMessage,
      responseMessage: connection.responseMessage,
      createdAt: connection.createdAt,
      respondedAt: connection.respondedAt,
      activePairLow: pairLow,
      activePairHigh: pairHigh,
    });
  }

  async existsActiveBetween(
    userA: string,
    userB: string,
  ): Promise<boolean> {
    const [pairLow, pairHigh] = this.getPair(userA, userB);

    const rows = await this.db
      .select({ id: connConnections.id })
      .from(connConnections)
      .where(
        and(
          eq(connConnections.activePairLow, pairLow),
          eq(connConnections.activePairHigh, pairHigh),
        ),
      )
      .limit(1);

    return rows.length > 0;
  }

  async existsAcceptedBetween(
    userA: string,
    userB: string,
  ): Promise<boolean> {
    const [pairLow, pairHigh] = this.getPair(userA, userB);

    const rows = await this.db
      .select({ id: connConnections.id })
      .from(connConnections)
      .where(
        and(
          eq(connConnections.activePairLow, pairLow),
          eq(connConnections.activePairHigh, pairHigh),
          eq(connConnections.status, "accepted"),
        ),
      )
      .limit(1);

    return rows.length > 0;
  }

  private getPair(userA: string, userB: string): [string, string] {
    return userA.localeCompare(userB) < 0
      ? [userA, userB]
      : [userB, userA];
  }
}
