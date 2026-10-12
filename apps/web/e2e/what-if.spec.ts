import path from "node:path";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { launchRoute } from "./journeys";
import { continuePastDelivery, stubLivery } from "./livery";
import { createAirline, MADRID_PLAYER, navigateInApp } from "./signup";

test.use(MADRID_PLAYER);

async function shot(page: Page, name: string) {
  if (!process.env.S64_SCREENSHOT) return;
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.resolve(process.env.S64_SCREENSHOT, `${name}-${test.info().project.name}.png`),
  });
}

// S64: profit per day against frequency and fares, with the sweet spot, now and max.
test("the what-if curves show profit by frequency and by fare", async ({ page, problems }) => {
  test.setTimeout(180_000);
  await stubLivery(page);
  await createAirline(page);
  await launchRoute(page, "BCN");
  await continuePastDelivery(page);

  await navigateInApp(page, "/network?tab=active");
  const control = page.getByTestId("route-frequency").first();
  await expect(control).toBeVisible({ timeout: 30_000 });
  await control.getByTestId("what-if-toggle").click();
  const curve = control.getByTestId("frequency-curve");
  await expect(curve).toBeVisible();
  await expect(curve.locator('[data-mark="best"]')).toHaveCount(1);
  await expect(curve.locator('[data-mark="now"]')).toHaveCount(1);
  await expect(curve.getByTestId("what-if-readout")).toContainText(
    /\/wk .*\/day · load \d+% · share \d+%/,
  );
  // Tapping the far left of the curve drafts the fewest flights; nothing is published yet.
  const box = await curve.locator("svg").boundingBox();
  if (!box) throw new Error("no chart");
  await page.mouse.click(box.x + 2, box.y + box.height / 2);
  await expect(control.getByRole("button", { name: "Apply" })).toBeVisible();
  await expect(control).toContainText("1/wk");
  await curve.scrollIntoViewIfNeeded();
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height / 2);
  await shot(page, "frequency-curve");

  await page
    .getByRole("button", { name: /edit fares/i })
    .first()
    .click();
  const fares = page.getByTestId("fare-curve");
  await expect(fares).toBeVisible({ timeout: 15_000 });
  await expect(fares.getByTestId("what-if-readout")).toContainText(/fares \d+%/);
  await fares.scrollIntoViewIfNeeded();
  await shot(page, "fare-curve");
  expect(problems.pageErrors).toEqual([]);
});
