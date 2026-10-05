import { expect, test } from "./fixtures";
import { createAirline, MADRID_PLAYER, navigateInApp } from "./signup";

test.use(MADRID_PLAYER);

// Outcome-first pricing (overhaul S24.2): the fare editor forecasts seats
// filled and profit as you type, and offers one-click presets.
test("the fare editor shows what a fare change would do", async ({ page, problems }) => {
  test.setTimeout(120_000);
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

  await navigateInApp(page, "/network?tab=active");
  await page
    .getByRole("button", { name: /edit fares/i })
    .first()
    .click();

  const outcome = page.getByTestId("fare-outcome");
  await expect(outcome).toBeVisible({ timeout: 15_000 });
  await expect(outcome).toContainText("Same as now");
  const load = page.getByTestId("fare-outcome-load");
  const profit = page.getByTestId("fare-outcome-profit");

  // Premium fares: the route still fills, so it earns more per day.
  await page.getByRole("button", { name: "Premium" }).click();
  await expect(page.getByRole("button", { name: "Premium" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(profit).toContainText(/\+\$[\d,]+ vs now/);

  // A far higher economy fare empties seats, and the forecast says so.
  await page.getByLabel("Economy").fill("400");
  await expect(load).toContainText(/−\d+ pts vs now/);
  await page.screenshot({ path: "test-results/fare-editor-premium.png" });
  expect(problems.pageErrors).toEqual([]);
});
