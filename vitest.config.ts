import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // server-only throws outside React Server Components; tests run in plain Node.
      "server-only": path.resolve(__dirname, "tests/empty.ts"),
    },
  },
});
