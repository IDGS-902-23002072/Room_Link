import { migrate } from "drizzle-orm/mysql2/migrator";
import { closeDatabase, db } from "./client.js";

try {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migraciones de MySQL aplicadas correctamente.");
} finally {
  await closeDatabase();
}
