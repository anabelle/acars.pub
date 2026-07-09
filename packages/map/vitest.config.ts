import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      exclude: [
        "src/**/*.test.ts",
        "dist/**",
        "vitest.config.ts",
        "src/index.ts",
        // Globe.tsx is a MapLibre-GL/WebGL React component (rendering, effects,
        // layer config). It is visual/integration code exercised by screenshot
        // and manual testing, not unit-testable. Its pure helpers (palette,
        // getSegmentCount, isMajorAirport, arcCacheKey) ARE unit-tested.
        "src/Globe.tsx",
      ],
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
    },
  },
});
