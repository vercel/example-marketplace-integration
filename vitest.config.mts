import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    env: {
      INTEGRATION_CLIENT_ID: "oac_test",
      INTEGRATION_CLIENT_SECRET: "test-secret",
    },
  },
});
