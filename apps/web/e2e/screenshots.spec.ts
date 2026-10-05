import path from "node:path";
import { gotoReady, test } from "./fixtures";
import { GUEST_ROUTES } from "./routes";

// Not a test: captures every guest route at phone and desktop width for
// before/after comparisons in UI PRs. Runs only in the `screenshots` project
// (`pnpm screenshots`), with the same fake relay and offline basemap as the
// smoke tests, so captures are comparable between runs.
const OUTPUT_DIR = path.resolve(process.cwd(), ".artifacts/screenshots");
const WIDTHS = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
];

for (const viewport of WIDTHS) {
  for (const route of GUEST_ROUTES) {
    test(`capture ${route.slug} @${viewport.width}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await gotoReady(page, route.path);
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
      await page.addStyleTag({
        content: "[data-sonner-toaster], [data-sonner-toast] { display: none !important; }",
      });
      await page.waitForTimeout(1_000);
      await page.screenshot({
        path: path.join(OUTPUT_DIR, String(viewport.width), `${route.slug}.png`),
      });
    });
  }
}
