import "dotenv/config";

const parsePort = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535) {
    throw new Error(`Puerto inválido: ${value}`);
  }
  return parsed;
};

export const config = {
  server: {
    port: parsePort(process.env.PORT, 3000),
  },
  database: {
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: parsePort(process.env.DB_PORT, 3306),
    user: process.env.DB_USER ?? "roomlink_app",
    password: process.env.DB_PASSWORD ?? "roomlink_school",
    database: process.env.DB_NAME ?? "roomlink",
  },
  // Base independiente de monitoreo. Nunca apunta a la BD principal roomlink.
  monitor: {
    host: process.env.MONITOR_DB_HOST ?? process.env.DB_HOST ?? "127.0.0.1",
    port: parsePort(process.env.MONITOR_DB_PORT ?? "3307", 3307),
    user: process.env.MONITOR_DB_USER ?? "roomlink_monitor",
    password: process.env.MONITOR_DB_PASSWORD ?? "roomlink_monitor_school",
    database: process.env.MONITOR_DB_NAME ?? "roomlink_monitor",
    ingestToken: process.env.MONITOR_INGEST_TOKEN ?? "",
  },
  auth: {
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    secureCookies:
      process.env.COOKIE_SECURE === "true" ||
      (process.env.COOKIE_SECURE !== "false" && process.env.NODE_ENV === "production"),
  },
} as const;

export const databaseUrl = `mysql://${encodeURIComponent(config.database.user)}:${encodeURIComponent(config.database.password)}@${config.database.host}:${config.database.port}/${config.database.database}`;

export const monitorDatabaseUrl = `mysql://${encodeURIComponent(config.monitor.user)}:${encodeURIComponent(config.monitor.password)}@${config.monitor.host}:${config.monitor.port}/${config.monitor.database}`;
