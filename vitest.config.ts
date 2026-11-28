import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: "./tests/setup.test.ts",
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/setup.test.ts"],
    isolate: true,  // Use isolated test mode
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});