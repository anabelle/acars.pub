import path from "node:path";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { flyingAirline } from "./journeys";
import { MADRID_PLAYER, navigateInApp } from "./signup";

test.use(MADRID_PLAYER);

async function shot(page: Page, name: string) {
  if (!process.env.S67_SCREENSHOT) return;
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.resolve(process.env.S67_SCREENSHOT, `${name}-${test.info().project.name}.png`),
  });
}

// S67: Lisbon and Barcelona connect through Madrid on two of the airline's flights.
test("on a phone, people connect through the hub on two of the airline's flights", async ({
  page,
  problems,
}) => {
  test.setTimeout(400_000);
  await flyingAirline(page, { destinations: ["BCN", "LIS"], hours: 3 });

  await navigateInApp(page, "/airport/MAD");
  const card = page.getByTestId("hub-connections");
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(card).toContainText(/connect through MAD/);
  await expect(card.getByTestId("hub-connection-pairs")).toContainText(/(LIS→BCN|BCN→LIS) \d+/);
  await card.scrollIntoViewIfNeeded();
  await shot(page, "hub-connections");
  expect(problems.pageErrors).toEqual([]);
});
