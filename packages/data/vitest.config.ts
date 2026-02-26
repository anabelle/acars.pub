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
      lines: 70,
      functions: 70,
      branches: 65,
      statements: 70,
    },
  },
});
