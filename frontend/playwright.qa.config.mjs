import { defineConfig } from '@playwright/test'
import mobile from './playwright.config.mjs'

export default defineConfig({
  ...mobile,
  testMatch: '**/qa-*.spec.mjs',
  use: {
    ...mobile.use,
    baseURL: process.env.E2E_QA_WEB_URL ?? 'http://localhost:3000',
    viewport: { width: 390, height: 844 },
    isMobile: false,
    trace: 'retain-on-failure',
    launchOptions: { args: mobile.use.launchOptions.args, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) },
  },
})
