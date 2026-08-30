import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.RESPONSIVE_VISUAL_BASE_URL ?? "http://127.0.0.1:3001";

export default defineConfig({
  testDir: "./tests/visual",
  snapshotDir: "./tests/visual/__screenshots__",
  outputDir: "test-results/visual",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "line",
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    viewport: { width: 1440, height: 900 },
    colorScheme: "light",
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
  },
  projects: [{ name: "desktop-chromium" }],
});
