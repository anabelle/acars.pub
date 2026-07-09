import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      exclude: ["src/**/*.test.ts", "dist/**", "vitest.config.ts", "src/index.ts", "src/types.ts"],
      thresholds: { lines: 66, functions: 85, branches: 67, statements: 66 },
    },
  },
});
