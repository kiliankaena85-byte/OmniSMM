import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["test_round_table.ts", "src/**/*.test.ts"],
    alias: {
      "@": path.resolve(__dirname, "../../src"),
    },
  },
});
