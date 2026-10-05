import { expect, test } from "./fixtures";
import { createAirline, MADRID_PLAYER, navigateInApp } from "./signup";

test.use(MADRID_PLAYER);

test("a player changes how often a route flies", async ({ page, problems }) => {
  test.setTimeout(120_000);
  await createAirline(page);

  // Launch MAD → BCN with its aircraft.
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

  // The route list shows the frequency control for it.
  await navigateInApp(page, "/network?tab=active");
  const control = page.getByTestId("route-frequency").first();
  await expect(control).toBeVisible({ timeout: 30_000 });
  await expect(control).toContainText("7/wk");
  await expect(control).toContainText(/2\.0 legs\/day/);

  await control.getByRole("button", { name: /more round trips/i }).click();
  await control.getByRole("button", { name: /more round trips/i }).click();
  await control.getByRole("button", { name: "Apply" }).click();

  await expect(control).toContainText("9/wk");
  await expect(control.getByRole("button", { name: "Apply" })).toHaveCount(0);
  await expect(control).toContainText(/2\.6 legs\/day/);
  expect(problems.pageErrors).toEqual([]);
});
