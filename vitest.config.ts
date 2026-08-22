import { defineConfig } from "vitest/config";
export default defineConfig({
  resolve: {
    alias: {
      "@": `${import.meta.dirname}/src`,
      "server-only": `${import.meta.dirname}/tests/unit/server-only.ts`,
    },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}", "tests/unit/**/*.test.ts"],
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      reporter: ["text", "html"],
    },
  },
});
