import path from "node:path";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { stubLivery } from "./livery";
import { createAirline, MADRID_PLAYER, navigateInApp } from "./signup";

test.use(MADRID_PLAYER);

async function shot(page: Page, name: string) {
  if (!process.env.S60_SCREENSHOT) return;
  await page.screenshot({
    path: path.resolve(process.env.S60_SCREENSHOT, `${name}-${test.info().project.name}.png`),
  });
}

/** A new airline launches MAD → BCN and game time runs until its plane is in the air. */
async function flyingPlane(page: Page) {
  await page.clock.install();
  await stubLivery(page);
  await createAirline(page);
  await navigateInApp(page, "/airport/BCN");
  await page
    .getByTestId("route-decision-card")
    .getByRole("button", { name: /launch route with/i })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: /^launch$/i })
    .click();
  await expect(page.getByText(/MAD → BCN is live/)).toBeVisible({ timeout: 30_000 });
  // Delivery day (S61): the leased plane arrives a few minutes later, with a ceremony.
  await page.clock.fastForward("00:05:00");
  const ceremony = page.getByTestId("delivery-ceremony");
  await expect(ceremony).toBeVisible({ timeout: 30_000 });
  await expect(ceremony.getByRole("heading")).not.toHaveText(/\d$/);
  await expect(ceremony.getByTestId("water-salute")).toBeVisible();
  await page.waitForTimeout(1_800);
  await shot(page, "delivery");
  await ceremony.getByRole("button", { name: /^continue$/i }).click();
  await expect(ceremony).toHaveCount(0);
  for (let i = 0; i < 6; i++) {
    await page.clock.fastForward("00:20:00");
    await page.waitForTimeout(400);
  }
  const later = page.getByRole("button", { name: /not now/i });
  if (await later.isVisible().catch(() => false)) await later.click();
}

test("a plane opens on its painting and reads its flight like a tracker", async ({
  page,
  problems,
}) => {
  test.setTimeout(240_000);
  await flyingPlane(page);
  await navigateInApp(page, "/fleet");
  await page.getByTestId("fleet-row").getByRole("button").filter({ hasText: /\S/ }).first().click();

  const hero = page.getByTestId("aircraft-hero");
  await expect(hero.getByRole("img")).toBeVisible({ timeout: 30_000 });
  await expect(hero.getByRole("heading")).toBeVisible();
  await expect(page.getByText(/generate-livery|HTTP \d{3}/)).toHaveCount(0);

  const strip = page.getByTestId("flight-strip");
  await expect(strip).toBeVisible({ timeout: 30_000 });
  await expect(strip).toContainText(/MAD|BCN/);
  await expect(strip).toContainText(/ETA \d\d:\d\dZ/);
  await expect(page.getByTestId("today-strip")).toBeVisible();
  await expect(page.getByTestId("logbook")).toBeVisible();
  await page.waitForTimeout(800);
  await shot(page, "plane-panel");
  await page.getByTestId("logbook").scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await shot(page, "logbook");

  // The hangar shows the same painting as a collection card (S60.2).
  await navigateInApp(page, "/fleet");
  await page.getByRole("button", { name: /^hangar$/i }).click();
  const card = page.getByTestId("hangar-tile").first();
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(card.getByRole("img").first()).toBeVisible({ timeout: 30_000 });
  await expect(card).toContainText("MAD → BCN");
  await expect(card).toContainText(/block h \/ 24 h/);
  await page.waitForTimeout(800);
  await shot(page, "hangar");

  // The spotter's book counts the types collected (S61.4).
  await page.getByRole("button", { name: /^spotter$/i }).click();
  await expect(page.getByTestId("spotter-progress")).toContainText(/^1 \/ \d+ types$/);
  await expect(page.getByTestId("spotter-card").first()).toHaveAttribute("data-state", "owned");
  await page.waitForTimeout(800);
  await shot(page, "spotter");
  expect(problems.pageErrors).toEqual([]);
});
