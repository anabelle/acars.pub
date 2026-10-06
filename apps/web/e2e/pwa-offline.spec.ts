import path from "node:path";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { createAirline, MADRID_PLAYER } from "./signup";

test.use({ ...MADRID_PLAYER, serviceWorkers: "allow" });

/** The top bar's airline name (rendered from the saved airline state). */
const airlineName = (page: Page) =>
  page.getByRole("heading", { name: "Offline Air", level: 1 }).first();

// S34: after one online visit the service worker serves the app shell, so an
// offline reload still boots and shows the last saved state, with a banner.
test("an offline reload shows the last saved state", async ({ page, context }) => {
  test.setTimeout(180_000);
  await createAirline(page, { name: "Offline Air" });
  await expect(airlineName(page)).toBeAttached({ timeout: 30_000 });

  // Wait until the service worker controls the page (it claims on activate).
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) =>
        navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true }),
      );
    }
  });
  // One more online load so this page's assets are in the runtime cache.
  await page.reload();
  await expect(airlineName(page)).toBeAttached({ timeout: 30_000 });

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId("offline-banner")).toBeVisible({ timeout: 30_000 });
  await expect(airlineName(page)).toBeAttached({ timeout: 30_000 });
  if (process.env.S34_SCREENSHOT) {
    await page.screenshot({ path: path.resolve(process.env.S34_SCREENSHOT, "offline.png") });
  }

  await context.setOffline(false);
  await expect(page.getByTestId("offline-banner")).toHaveCount(0);
});
