import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      exclude: ["src/**/*.test.ts", "dist/**", "vitest.config.ts", "src/index.ts"],
      thresholds: { lines: 99, functions: 100, branches: 95, statements: 99 },
    },
  },
});
