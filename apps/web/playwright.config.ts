import { defineConfig, devices } from "@playwright/test";

// Browser smoke tests run against the **built** app served by `vite preview`,
// so they exercise the same bundle (and the same static maplibre worker files)
// that Cloudflare Pages ships. Run `pnpm build` first.
//
// Locally, point CHROMIUM_PATH at an existing Chromium if Playwright's own
// browser isn't installed (e.g. /opt/pw-browsers/chromium in cloud sandboxes).
// In CI the workflow installs Playwright's Chromium and leaves it unset.
const PORT = Number(process.env.E2E_PORT ?? 4173);
const executablePath = process.env.CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    launchOptions: { executablePath },
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: `pnpm exec vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
