import path from "node:path";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { flyingAirline } from "./journeys";
import { MADRID_PLAYER, navigateInApp } from "./signup";

test.use(MADRID_PLAYER);

async function shot(page: Page, name: string) {
  if (!process.env.S63_SCREENSHOT) return;
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.resolve(process.env.S63_SCREENSHOT, `${name}-${test.info().project.name}.png`),
  });
}

// S63: passengers are visible — a cabin and a receipt per landing, booking bars on boards.
test("on a phone, passengers show in the cabin, on the receipt and on the boards", async ({
  page,
  problems,
}) => {
  test.setTimeout(400_000);
  await flyingAirline(page, { destinations: ["BCN", "LIS"], hours: 4 });

  await navigateInApp(page, "/fleet");
  await page.getByTestId("fleet-row").getByRole("button").filter({ hasText: /\S/ }).first().click();
  const lastFlight = page.getByTestId("last-flight");
  await expect(lastFlight).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("cabin-strip")).toHaveAccessibleName(/\d+ of \d+ seats taken/);
  await expect(page.getByTestId("landing-receipt")).toContainText("Net");
  await page.getByTestId("landing-receipt").scrollIntoViewIfNeeded();
  await shot(page, "last-flight");

  await navigateInApp(page, "/airport/MAD?airportTab=flights");
  await expect(page.getByTestId("booking-bar").first()).toBeVisible({ timeout: 30_000 });
  await shot(page, "booking-bars");

  await navigateInApp(page, "/airport/MAD");
  const turnedAway = page.getByTestId("turned-away-here");
  if (await turnedAway.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await turnedAway.scrollIntoViewIfNeeded();
    await shot(page, "turned-away");
  }
  expect(problems.pageErrors).toEqual([]);
});
