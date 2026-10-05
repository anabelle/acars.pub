import { expect, test } from "./fixtures";
import { createAirline, MADRID_PLAYER, navigateInApp } from "./signup";

test.use(MADRID_PLAYER);

test("after 12 hours away, the report tells what the airline did", async ({ page, problems }) => {
  test.setTimeout(240_000);
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

  // Stay long enough for the last-seen heartbeat, with no report for a fresh airline.
  await page.clock.runFor(35_000);
  await expect(page.getByTestId("away-report")).toHaveCount(0);

  // The player leaves for 12 hours (the tab stays open: the device sleeps).
  await page.clock.fastForward("12:00:00");

  const report = page.getByTestId("away-report");
  await expect(report).toBeVisible({ timeout: 180_000 });
  await expect(report).toContainText(/While you were away · 1[12] hours/);
  await expect(report.getByTestId("away-report-profit")).toBeVisible();
  await expect(report).toContainText("MAD ⇄ BCN");

  if (process.env.AWAY_REPORT_SCREENSHOT) {
    await page.screenshot({ path: process.env.AWAY_REPORT_SCREENSHOT });
  }

  await report.getByRole("button", { name: /back to my airline/i }).click();
  await expect(report).toHaveCount(0);
  expect(problems.pageErrors).toEqual([]);
});
