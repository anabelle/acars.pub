import path from "node:path";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { publishedRoute } from "./journeys";
import { continuePastDelivery } from "./livery";
import { MADRID_PLAYER, navigateInApp } from "./signup";

test.use(MADRID_PLAYER);

async function shot(page: Page, name: string) {
  if (!process.env.S69_SCREENSHOT) return;
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.resolve(process.env.S69_SCREENSHOT, `${name}-${test.info().project.name}.png`),
  });
}

// S69: on a route already on sale, fare and frequency changes are announced for 00:00 UTC.
test("on a phone, changes to a published route are announced and take effect at midnight UTC", async ({
  page,
  problems,
}) => {
  test.setTimeout(300_000);
  await publishedRoute(page);

  await navigateInApp(page, "/network?tab=active");
  const control = page.getByTestId("route-frequency").first();
  await expect(control).toBeVisible({ timeout: 30_000 });
  const weekly = Number(/(\d+)\/wk/.exec((await control.textContent()) ?? "")?.[1]);
  expect(weekly).toBeGreaterThan(2);

  // Frequency: announced, not applied.
  await control.getByRole("button", { name: /fewer round trips/i }).click();
  await expect(control.getByTestId("timetable-hint")).toContainText("00:00 UTC tomorrow");
  await control.getByRole("button", { name: "Announce for tomorrow" }).click();
  const announced = page.getByTestId("timetable-announced").first();
  await expect(announced).toContainText(`${weekly - 1}/wk`, { timeout: 15_000 });

  // Fares: the editor says when, and the card shows what's coming.
  await page
    .getByRole("button", { name: /edit fares/i })
    .first()
    .click();
  await expect(page.getByTestId("timetable-hint")).toContainText("00:00 UTC tomorrow");
  const economy = page.getByLabel("Economy");
  const today = Number(await economy.inputValue());
  const next = today - 10;
  await economy.fill(String(next));
  await page.getByRole("button", { name: "Announce for tomorrow" }).click();
  await expect(announced).toContainText(`E $${next}`, { timeout: 15_000 });
  await expect(announced).toContainText(`${weekly - 1}/wk`);
  await announced.scrollIntoViewIfNeeded();
  await shot(page, "timetable-announced");

  // Past midnight UTC the announcement is the timetable.
  await page.clock.fastForward("23:50:00");
  await page.waitForTimeout(1500);
  await continuePastDelivery(page);
  await navigateInApp(page, "/network?tab=active");
  await expect(page.getByTestId("timetable-announced")).toHaveCount(0, { timeout: 60_000 });
  await expect(page.getByTestId("route-frequency").first()).toContainText(`${weekly - 1}/wk`);
  await expect(page.getByText(`E: $${next}`).first()).toBeVisible();
  expect(problems.pageErrors).toEqual([]);
});
