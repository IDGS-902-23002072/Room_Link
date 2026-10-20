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
} as const;

export const databaseUrl = `mysql://${encodeURIComponent(config.database.user)}:${encodeURIComponent(config.database.password)}@${config.database.host}:${config.database.port}/${config.database.database}`;
