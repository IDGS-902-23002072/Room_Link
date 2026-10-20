import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { checkDatabase } from "./db/client.js";

const app = createApp({ checkDatabase });

serve({ fetch: app.fetch, port: config.server.port }, ({ port }) => {
  console.log(`Room_Link API escuchando en http://localhost:${port}`);
});
