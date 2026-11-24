import fs from "node:fs";
import { defineConfig } from "@playwright/test";

function resolveChromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const candidates = [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ];
  return candidates.find((p) => fs.existsSync(p));
}

const executablePath = resolveChromePath();

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.playwright.spec.mjs",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_WEB_URL ?? "http://localhost:8081",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    headless: true,
    launchOptions: {
      ...(executablePath ? { executablePath } : {}),
      args: ["--no-sandbox", "--disable-gpu"],
    },
  },
});
