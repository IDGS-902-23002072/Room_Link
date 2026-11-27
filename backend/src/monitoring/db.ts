import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { config } from "../config.js";
import * as schema from "./schema.js";

/**
 * Pool exclusivo de la base de monitoreo (`roomlink_monitor`).
 * Máximo 2 conexiones según las reglas fijas del plan. Nunca se importa
 * desde `/ready`: la disponibilidad de la API no depende de esta base.
 */
export const monitorPool = mysql.createPool({
  host: config.monitor.host,
  port: config.monitor.port,
  user: config.monitor.user,
  password: config.monitor.password,
  database: config.monitor.database,
  waitForConnections: true,
  connectionLimit: 2,
  timezone: "Z",
});

export const monitorDb = drizzle(monitorPool, { schema, mode: "default" });

export const checkMonitorDatabase = async (): Promise<void> => {
  await monitorPool.query("SELECT 1");
};

export const closeMonitorDatabase = async (): Promise<void> => {
  await monitorPool.end();
};
