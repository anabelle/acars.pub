import path from "node:path";
import { expect, test } from "./fixtures";
import { createAirline, MADRID_PLAYER, navigateInApp } from "./signup";

test.use(MADRID_PLAYER);

test("route rows show the liveries of their aircraft", async ({ page, problems }) => {
  test.setTimeout(120_000);
  await createAirline(page);

  await navigateInApp(page, "/airport/BCN");
  const card = page.getByTestId("route-decision-card");
  await expect(card).toBeVisible({ timeout: 30_000 });
  await card.getByRole("button", { name: /launch route with/i }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: /^launch$/i })
    .click();
  await expect(page.getByText(/MAD → BCN is live/)).toBeVisible({ timeout: 30_000 });

  await navigateInApp(page, "/network");
  const liveries = page.getByTestId("route-liveries").first();
  await expect(liveries).toBeVisible({ timeout: 30_000 });
  // No AI livery in the test environment: the silhouette fallback shows.
  await expect(liveries.getByTestId("livery-thumb")).toHaveCount(1);
  await expect(liveries.getByTestId("livery-thumb")).toHaveAttribute("data-has-image", "false");
  if (process.env.S44_SCREENSHOT) {
    await page.screenshot({ path: path.resolve(process.env.S44_SCREENSHOT, "route-liveries.png") });
  }
  expect(problems.pageErrors).toEqual([]);
});
