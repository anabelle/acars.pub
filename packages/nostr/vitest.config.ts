import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      exclude: ["src/**/*.test.ts", "dist/**"],
      lines: 60,
      functions: 60,
      branches: 55,
      statements: 60,
    },
  },
});
