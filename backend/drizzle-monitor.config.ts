import { defineConfig } from "drizzle-kit";
import { monitorDatabaseUrl } from "./src/config.js";

/** Migraciones exclusivas de `roomlink_monitor`. Nunca apunta a `roomlink`. */
export default defineConfig({
  dialect: "mysql",
  schema: "./src/monitoring/schema.ts",
  out: "./drizzle-monitor",
  dbCredentials: {
    url: monitorDatabaseUrl,
  },
  strict: true,
  verbose: true,
});
