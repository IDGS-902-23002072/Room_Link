import type { Connection } from "../entities/Connection.js";

export type ConnectionDirection = "incoming" | "outgoing" | "all";

export interface IConnectionRepository {
  findById(id: string): Promise<Connection | null>;
  listForUser(userId: string, direction: ConnectionDirection): Promise<Connection[]>;
  update(connection: Connection): Promise<void>;
}
