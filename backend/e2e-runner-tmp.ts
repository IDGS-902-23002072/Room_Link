import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { serve } from "@hono/node-server";
import { createApp } from "./src/app.js";
import { InProcessEventBus } from "./src/modules/notifications/index.js";
import { createAuthFakes } from "./tests/helpers/auth-fakes.js";
import {
  InMemoryActivityLogRepository,
  InMemoryAgreementRepository,
  InMemoryAnalyticsRepository,
  InMemoryApplicationRepository,
  InMemoryCompatibilityRepository,
  InMemoryConnectionRepository,
  InMemoryMessagingRepository,
  InMemoryModerationRepository,
  InMemoryNotificationRepository,
  InMemoryProfileRepository,
  InMemoryRoomRepository,
  InMemorySanctionRepository,
  InMemorySearchRepository,
  InMemoryUserRepository,
  ZeroAnalyticsSource,
} from "./tests/helpers/in-memory-repos.js";

const userRepo = new InMemoryUserRepository();
const profileRepo = new InMemoryProfileRepository();
const roomRepo = new InMemoryRoomRepository();
const appRepo = new InMemoryApplicationRepository();
const compatibilityRepo = new InMemoryCompatibilityRepository();
const connectionRepo = new InMemoryConnectionRepository();
const messagingRepo = new InMemoryMessagingRepository();
const moderationRepo = new InMemoryModerationRepository();
const sanctionRepo = new InMemorySanctionRepository();
const notificationRepo = new InMemoryNotificationRepository();
const agreementRepo = new InMemoryAgreementRepository();
const analyticsRepo = new InMemoryAnalyticsRepository();
const searchRepo = new InMemorySearchRepository(profileRepo, roomRepo);

const outbox = { publish: async () => {} };
const bus = new InProcessEventBus(outbox);
const authFakes = createAuthFakes();
authFakes.dependencies.eventPublisher = bus;

const app = createApp({
  checkDatabase: async () => {},
  userRepo,
  profileRepo,
  roomRepo,
  appRepo,
  compatibilityRepo,
  connectionRepo,
  messagingRepo,
  moderationRepo,
  sanctionRepo,
  notificationRepo,
  agreementRepo,
  analyticsRepo,
  searchRepo,
  analyticsSource: new ZeroAnalyticsSource(),
  activityLogRepo: new InMemoryActivityLogRepository(),
  authDependencies: authFakes.dependencies,
});

const apiServer = serve({ fetch: app.fetch, port: 3000 });

const distDir = path.resolve("../frontend/Room_Link/dist");
const mimeTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

const webServer = http.createServer((req, res) => {
  const urlPath = (req.url ?? "/").split("?")[0] || "/";
  let filePath = path.join(distDir, urlPath === "/" ? "index.html" : urlPath);
  if (!fs.existsSync(filePath) && fs.existsSync(`${filePath}.html`)) {
    filePath = `${filePath}.html`;
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(distDir, "index.html");
  }
  const ext = path.extname(filePath);
  res.setHeader("Content-Type", mimeTypes[ext] ?? "application/octet-stream");
  res.end(fs.readFileSync(filePath));
});

webServer.listen(8081, async () => {
  console.log("API Server on :3000 & Static Web Server on :8081 ready");
  const child = spawn(
    process.execPath,
    ["--test", "tests/e2e/mobile-auth.e2e.mjs"],
    {
      cwd: path.resolve("../frontend"),
      stdio: "inherit",
      env: {
        ...process.env,
        E2E_API_URL: "http://localhost:3000/api/v1",
        E2E_WEB_URL: "http://localhost:8081",
      },
    },
  );
  child.on("exit", (code) => {
    webServer.close();
    apiServer.close();
    process.exit(code ?? 1);
  });
});
