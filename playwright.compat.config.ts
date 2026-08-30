import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /responsive.*\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  retries: 0,
  reporter: "line",
  outputDir: "test-results/compat",
  use: {
    ...devices["iPhone 13"],
    baseURL: "http://127.0.0.1:3001",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- -p 3001",
    url: "http://127.0.0.1:3001",
    reuseExistingServer: true,
  },
  projects: [{ name: "desktop" }],
});
