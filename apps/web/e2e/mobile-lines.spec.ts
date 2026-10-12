import path from "node:path";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { launchRoute } from "./journeys";
import { continuePastDelivery, stubLivery } from "./livery";
import { createAirline, MADRID_PLAYER, navigateInApp } from "./signup";

test.use(MADRID_PLAYER);

async function shot(page: Page, name: string) {
  if (!process.env.S66_SCREENSHOT) return;
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.resolve(process.env.S66_SCREENSHOT, `${name}-${test.info().project.name}.png`),
  });
}

// S66: lines of flying — plan a plane's day over two routes, then watch it fly.
test("on a phone, a plane flies a day plan over several routes", async ({ page, problems }) => {
  test.setTimeout(400_000);
  // 03:00 UTC, so the line's first departure (06:00) is today.
  await page.clock.install({ time: new Date("2026-10-12T03:00:00Z") });
  await stubLivery(page);
  await createAirline(page);
  await launchRoute(page, "BCN");
  await launchRoute(page, "LIS");

  // Plan the first plane's day while it is still on the ground.
  await navigateInApp(page, "/fleet");
  await page.getByTestId("fleet-row").getByRole("button").filter({ hasText: /\S/ }).first().click();
  const section = page.getByTestId("line-section");
  await expect(section).toBeVisible({ timeout: 30_000 });
  await section.scrollIntoViewIfNeeded();
  await section.getByTestId("line-open").click();
  const builder = page.getByTestId("line-builder");
  await builder.getByTestId("line-autofill").click();
  await expect(builder.getByTestId("line-status")).toContainText(/Back at MAD at \d\d:\d\dZ/);
  await expect(builder.getByTestId("line-board-leg").first()).toBeVisible();
  await shot(page, "line-builder");
  await builder.getByTestId("line-save").click();
  await expect(builder).toHaveCount(0);
  await expect(section.getByTestId("line-route")).toContainText(/^MAD→.*→MAD$/);

  // Six hours of the day: the line flies its legs and records delays.
  await page.clock.fastForward("00:05:00");
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(400);
    await continuePastDelivery(page);
  }
  for (let step = 0; step < 18; step++) {
    await page.clock.fastForward("00:20:00");
    await page.waitForTimeout(300);
    await continuePastDelivery(page);
  }
  const later = page.getByRole("button", { name: /not now/i });
  if (await later.isVisible().catch(() => false)) await later.click();

  await navigateInApp(page, "/fleet");
  await page.getByTestId("fleet-row").getByRole("button").filter({ hasText: /\S/ }).first().click();
  await expect(page.getByTestId("line-on-time")).toContainText(/On time \d+% of \d+ flights/, {
    timeout: 30_000,
  });
  await expect(page.getByTestId("plane-acars").getByTestId("acars-message").first()).toBeVisible();
  await page.getByTestId("line-section").scrollIntoViewIfNeeded();
  await shot(page, "line-flying");
  expect(problems.pageErrors).toEqual([]);
});
