import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { createAirline, MADRID_PLAYER, navigateInApp } from "./signup";

test.use(MADRID_PLAYER);

/** A Madrid airline flying MAD → BCN whose player comes back after 12 hours. */
async function flyThenLeave(page: Page) {
  // Fake timers with time flowing normally, so we can jump ahead later.
  await page.clock.install();
  await createAirline(page);

  // Get a route flying: launch MAD → BCN from the airport card.
  await navigateInApp(page, "/airport/BCN");
  const card = page.getByTestId("route-decision-card");
  await card.getByRole("button", { name: /launch route with/i }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: /^launch$/i })
    .click();
  await expect(page.getByText(/MAD → BCN is live/)).toBeVisible({ timeout: 30_000 });

  // Stay long enough for the last-seen heartbeat, with no report for a fresh
  // airline. Jump the clock (firing the heartbeat once) rather than rendering
  // every frame of those 35 seconds, which costs minutes on the software-
  // rendered globe in CI.
  await page.clock.fastForward(35_000);
  await expect(page.getByTestId("away-report")).toHaveCount(0);

  // The player leaves for 12 hours (the tab stays open: the device sleeps).
  await page.clock.fastForward("12:00:00");
}

test("after 12 hours away, the report tells what the airline did and links to it", async ({
  page,
  problems,
}) => {
  test.setTimeout(240_000);
  await flyThenLeave(page);

  const report = page.getByTestId("away-report");
  await expect(report).toBeVisible({ timeout: 180_000 });
  await expect(report).toContainText(/While you were away · 1[12] hours/);
  await expect(report.getByTestId("away-report-profit")).toBeVisible();
  await expect(report).toContainText("MAD ⇄ BCN");

  if (process.env.AWAY_REPORT_SCREENSHOT) {
    await page.screenshot({ path: process.env.AWAY_REPORT_SCREENSHOT });
  }

  // The catch-up is told by the report, not replayed as a burst of stale toasts.
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);

  // Deep link: the best route opens its airport panel and closes the report.
  await report.getByRole("link", { name: /best route/i }).click();
  await expect(report).toHaveCount(0);
  await expect(page).toHaveURL(/\/airport\/BCN/);
  expect(problems.pageErrors).toEqual([]);
});

test("the away report replays the missed flights on the map (S55.3)", async ({
  page,
  problems,
}) => {
  test.setTimeout(240_000);
  await flyThenLeave(page);

  const report = page.getByTestId("away-report");
  await expect(report).toBeVisible({ timeout: 180_000 });
  await report.getByTestId("away-report-watch").click();
  await expect(report).toHaveCount(0);

  // The replay plays the night in at most 30 s: flights land as it runs.
  const bar = page.getByTestId("time-lapse-bar");
  await expect(bar).toBeVisible();
  const total = Number(await bar.getAttribute("data-total"));
  expect(total).toBeGreaterThan(1);
  await page.clock.fastForward(10_000);
  await expect
    .poll(async () => Number(await bar.getAttribute("data-landed")), { timeout: 30_000 })
    .toBeGreaterThan(0);

  if (process.env.TIME_LAPSE_SCREENSHOT) {
    await page.screenshot({ path: process.env.TIME_LAPSE_SCREENSHOT });
  }

  // It ends by itself and hands the map back to the live airline (the stop
  // button is covered by the component test; the clock keeps running here).
  await page.clock.fastForward(40_000);
  await expect(bar).toHaveCount(0, { timeout: 30_000 });
  expect(problems.pageErrors).toEqual([]);
});
