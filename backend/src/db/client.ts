import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { config } from "../config.js";
import * as schema from "./schema/index.js";

export const pool = mysql.createPool({
  ...config.database,
  waitForConnections: true,
  connectionLimit: 10,
  timezone: "Z",
  ...(process.env.DB_SSL === "true"
    ? { ssl: { minVersion: "TLSv1.2", rejectUnauthorized: false } }
    : {}),
});

export const db = drizzle(pool, { schema, mode: "default" });

export const checkDatabase = async (): Promise<void> => {
  await pool.query("SELECT 1");
};

export const closeDatabase = async (): Promise<void> => {
  await pool.end();
};
