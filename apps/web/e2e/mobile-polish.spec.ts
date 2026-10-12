import { expect, test } from "./fixtures";
import { continuePastDelivery, stubLivery } from "./livery";
import { createAirline, MADRID_PLAYER, navigateInApp } from "./signup";

test.use(MADRID_PLAYER);

// Polish pass (overhaul S77): what a scripted playtest found, kept fixed.

test("on a phone, a new player launches from the opportunities with a plane, and sees what it does", async ({
  page,
  problems,
}) => {
  test.setTimeout(180_000);
  await page.clock.install();
  await stubLivery(page);
  await createAirline(page);

  await navigateInApp(page, "/?panel=cockpit");
  const checklist = page.getByTestId("first-hour-checklist");
  await expect(checklist).toBeVisible({ timeout: 30_000 });
  await checklist.getByRole("link", { name: /find a route/i }).click();
  await expect(page).toHaveURL(/\/network\?tab=opportunities/);

  // The button launches a route with its plane, not a bare $100,000 route.
  const launch = page.getByTestId("opportunity-launch").first();
  await expect(launch).toHaveText(/launch route/i, { timeout: 30_000 });
  await page.screenshot({ path: "test-results/mobile-polish-opportunities.png" });
  await launch.click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText(/lease deposit/i);
  await page.screenshot({ path: "test-results/mobile-polish-opportunity-confirm.png" });
  await confirm.getByRole("button", { name: /^launch$/i }).click();
  await expect(page.getByText(/is live/).first()).toBeVisible({ timeout: 30_000 });

  await page.clock.fastForward("00:05:00");
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(400);
    await continuePastDelivery(page);
  }

  // The fleet says plainly what the plane does.
  await navigateInApp(page, "/fleet");
  const duty = page.getByTestId("aircraft-duty").first();
  await expect(duty).toContainText(/^Flies MAD ⇄ [A-Z]{3} back and forth$/, { timeout: 30_000 });
  await expect(page.getByText(/^Registration$/i).first()).toBeVisible();
  await page.screenshot({ path: "test-results/mobile-polish-fleet-duty.png" });
  expect(problems.pageErrors).toEqual([]);
});

test("on a phone, a confirm never outlives the page that asked it", async ({ page, problems }) => {
  test.setTimeout(120_000);
  await createAirline(page);
  await navigateInApp(page, "/network?tab=opportunities");
  await page.getByTestId("opportunity-launch").first().click();
  await expect(page.getByRole("alertdialog")).toBeVisible();

  await navigateInApp(page, "/airport/BCN");
  await expect(page.getByRole("alertdialog")).toBeHidden();
  await expect(page.getByTestId("route-decision-card")).toBeVisible({ timeout: 30_000 });
  expect(problems.pageErrors).toEqual([]);
});
