import { defineConfig } from "vitest/config";

// `pnpm balance`: runs the report generator (src/balance/*.run.ts) only.
// Kept apart from the unit-test config so `pnpm test` never writes files.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/balance/*.run.ts"],
    testTimeout: 120_000,
  },
});
