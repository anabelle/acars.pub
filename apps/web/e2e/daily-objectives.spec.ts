import path from "node:path";
import { expect, test } from "./fixtures";
import { createAirline, MADRID_PLAYER, navigateInApp } from "./signup";

test.use(MADRID_PLAYER);

const shot = async (page: import("@playwright/test").Page, name: string) => {
  if (!process.env.S32_SCREENSHOT) return;
  await page
    .getByTestId("daily-objectives")
    .screenshot({ path: path.resolve(process.env.S32_SCREENSHOT, name) });
};

// S32: today's objectives show in the cockpit, fill from real actions, and
// a completed one is claimed for its reward (en + es). The clock is pinned to
// 2026-10-09, whose objectives are: tune fares, adjust a schedule, acquire
// an aircraft.
test("a player completes and claims a daily objective", async ({ page, problems }) => {
  test.setTimeout(180_000);
  await page.clock.install({ time: new Date("2026-10-09T10:00:00Z") });
  await createAirline(page);

  await navigateInApp(page, "/?panel=cockpit");
  const card = page.getByTestId("daily-objectives");
  await card.scrollIntoViewIfNeeded();
  await expect(card).toContainText("Today's goals", { timeout: 30_000 });
  await expect(card).toContainText("Change a route's weekly frequency");
  await expect(card).toContainText("Adjust the fares on a route");
  await expect(card).toContainText("Buy or lease an aircraft");
  const schedule = card.getByTestId("objective-adjustSchedule");
  await expect(schedule).toHaveAttribute("data-complete", "false");
  await shot(page, "objectives-start-en.png");

  // Launch MAD → BCN, then fly it more often.
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
  await page
    .getByRole("button", { name: /close airport panel/i })
    .first()
    .click();

  await navigateInApp(page, "/network?tab=active");
  const control = page.getByTestId("route-frequency").first();
  await expect(control).toBeVisible({ timeout: 30_000 });
  await control.getByRole("button", { name: /more round trips/i }).click();
  await control.getByRole("button", { name: "Apply" }).click();
  await expect(control).toContainText("8/wk");

  // Back in the cockpit the objective is complete and claimable.
  await navigateInApp(page, "/?panel=cockpit");
  await card.scrollIntoViewIfNeeded();
  await expect(schedule).toHaveAttribute("data-complete", "true", { timeout: 30_000 });
  await shot(page, "objectives-claimable-en.png");

  await schedule.getByRole("button", { name: "Claim" }).click();
  await expect(schedule).toHaveAttribute("data-claimed", "true", { timeout: 30_000 });
  await expect(schedule).toContainText("Claimed");
  await expect(page.getByText("Reward claimed")).toBeVisible();
  await shot(page, "objectives-claimed-en.png");

  // Spanish: the claim survives a reload.
  await page.evaluate(() => localStorage.setItem("acars-language", "es"));
  await page.reload();
  await navigateInApp(page, "/?panel=cockpit");
  await expect(card).toContainText("Metas de hoy", { timeout: 30_000 });
  await card.scrollIntoViewIfNeeded();
  await expect(schedule).toHaveAttribute("data-claimed", "true");
  await expect(schedule).toContainText("Reclamado");
  await shot(page, "objectives-claimed-es.png");

  expect(problems.pageErrors).toEqual([]);
});
