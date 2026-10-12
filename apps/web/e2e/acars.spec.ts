import path from "node:path";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { flyingAirline } from "./journeys";
import { MADRID_PLAYER, navigateInApp } from "./signup";

test.use(MADRID_PLAYER);

async function shot(page: Page, name: string) {
  if (!process.env.S65_SCREENSHOT) return;
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.resolve(process.env.S65_SCREENSHOT, `${name}-${test.info().project.name}.png`),
  });
}

// S65: OUT/OFF/ON/IN and position reports, derived from the engine's own flights.
test("the airline and each plane talk in ACARS messages", async ({ page, problems }) => {
  test.setTimeout(400_000);
  await flyingAirline(page, { destinations: ["BCN", "LIS"], hours: 4 });

  await navigateInApp(page, "/?panel=cockpit");
  const feed = page.getByTestId("airline-acars");
  await expect(feed).toBeVisible({ timeout: 30_000 });
  const rows = feed.getByTestId("acars-message");
  await expect(rows.first()).toBeVisible();
  for (const kind of ["OUT", "OFF", "ON", "IN"]) {
    await expect(feed.locator(`[data-kind="${kind}"]`).first()).toBeVisible();
  }
  await expect(feed.locator('[data-kind="IN"]').first()).toContainText(/PAX \d+ LF \d+%/);
  await feed.scrollIntoViewIfNeeded();
  await shot(page, "airline-acars");

  // The flight number opens the plane, whose panel lists its own messages.
  await feed.getByRole("button").first().click();
  const planeFeed = page.getByTestId("plane-acars");
  await expect(planeFeed).toBeVisible({ timeout: 30_000 });
  await expect(planeFeed.getByTestId("acars-message").first()).toBeVisible();
  await planeFeed.scrollIntoViewIfNeeded();
  await shot(page, "plane-acars");
  expect(problems.pageErrors).toEqual([]);
});
