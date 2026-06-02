import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: "./tests/setup.test.ts",
    isolate: false,
    testTimeout: 10000,
  },
});
