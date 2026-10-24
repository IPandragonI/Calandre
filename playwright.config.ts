import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against the production build (`pnpm build` first), so the
 * service worker and offline behaviour are tested as shipped.
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  // Own port, so a `next dev` left running on :3000 is never reused by mistake.
  use: { baseURL: "http://localhost:3300", trace: "retain-on-failure" },
  projects: [
    {
      name: "desktop",
      testIgnore: /mobile\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 860 } },
    },
    {
      name: "mobile",
      testMatch: /mobile\.spec\.ts/,
      use: { ...devices["iPhone 13"], browserName: "chromium" },
    },
  ],
  webServer: {
    command: "pnpm start -p 3300",
    url: "http://localhost:3300",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
