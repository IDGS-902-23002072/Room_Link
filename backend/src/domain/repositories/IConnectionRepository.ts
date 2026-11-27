import type { Connection } from "../entities/Connection.js";

export type ConnectionDirection = "incoming" | "outgoing" | "all";

export interface IConnectionRepository {
  findById(id: string): Promise<Connection | null>;

  listForUser(
    userId: string,
    direction: ConnectionDirection,
  ): Promise<Connection[]>;

  create(connection: Connection): Promise<void>;

  update(connection: Connection): Promise<void>;

  existsActiveBetween(
    userA: string,
    userB: string,
  ): Promise<boolean>;

  existsAcceptedBetween(
    userA: string,
    userB: string,
  ): Promise<boolean>;
}
