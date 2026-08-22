import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

const localEnv = loadEnv("development", import.meta.dirname, "NEXT_PUBLIC_");

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 20_000,
    env: localEnv,
  },
});
