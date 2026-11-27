import "dotenv/config";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { closeMonitorDatabase, monitorDb } from "./db.js";

try {
  await migrate(monitorDb, { migrationsFolder: "./drizzle-monitor" });
  console.log("Migraciones de roomlink_monitor aplicadas correctamente.");
} finally {
  await closeMonitorDatabase();
}
