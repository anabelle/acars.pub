import path from "node:path";
import { expect, test } from "./fixtures";
import { createAirline, MADRID_PLAYER, navigateInApp } from "./signup";

test.use(MADRID_PLAYER);

async function launch(page: import("@playwright/test").Page, destination: string, label: RegExp) {
  await navigateInApp(page, `/airport/${destination}`);
  const card = page.getByTestId("route-decision-card");
  await expect(card).toBeVisible({ timeout: 30_000 });
  await card.getByRole("button", { name: /launch route with/i }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: /^launch$/i })
    .click();
  await expect(page.getByText(label)).toBeVisible({ timeout: 30_000 });
}

test("adds an aircraft to a route from the route list", async ({ page, problems }) => {
  test.setTimeout(150_000);
  await createAirline(page);
  await launch(page, "BCN", /MAD → BCN is live/);
  await launch(page, "LIS", /MAD → LIS is live/);

  await navigateInApp(page, "/network");
  const bcnRow = page.getByTestId("route-add-aircraft").first();
  await expect(bcnRow).toBeVisible({ timeout: 30_000 });
  await bcnRow.click();

  const dialog = page.getByTestId("assign-aircraft-dialog");
  await expect(dialog).toBeVisible();
  const ready = dialog.locator('[data-testid="assign-candidate"][data-kind="ready"]');
  await expect(ready).toHaveCount(1);
  await expect(ready).toContainText(/leaves its current route/i);
  if (process.env.S25_SCREENSHOT) {
    await page.screenshot({
      path: path.resolve(process.env.S25_SCREENSHOT, "add-aircraft.png"),
    });
  }
  await ready.getByRole("button", { name: /^assign$/i }).click();
  await expect(page.getByText(/now flies MAD–(BCN|LIS)/)).toBeVisible({ timeout: 30_000 });
  await expect(dialog).toHaveCount(0);

  expect(problems.pageErrors).toEqual([]);
});

test("assigns a route from the aircraft panel", async ({ page, problems }) => {
  test.setTimeout(150_000);
  await createAirline(page);
  await launch(page, "BCN", /MAD → BCN is live/);
  await launch(page, "LIS", /MAD → LIS is live/);

  await navigateInApp(page, "/fleet");
  const firstAircraft = page
    .getByTestId("fleet-row")
    .getByRole("button")
    .filter({ hasText: /\S/ })
    .first();
  await expect(firstAircraft).toBeVisible({ timeout: 30_000 });
  await firstAircraft.click();

  const assignButton = page.getByTestId("aircraft-assign-route");
  await expect(assignButton).toBeVisible({ timeout: 30_000 });
  await expect(assignButton).toHaveText(/change route/i);
  await assignButton.click();

  const dialog = page.getByTestId("assign-route-dialog");
  await expect(dialog).toBeVisible();
  const ready = dialog.locator('[data-testid="assign-route-candidate"][data-kind="ready"]');
  await expect(ready).toHaveCount(1);
  if (process.env.S25_SCREENSHOT) {
    await page.screenshot({
      path: path.resolve(process.env.S25_SCREENSHOT, "assign-route.png"),
    });
  }
  await ready.getByRole("button", { name: /^assign$/i }).click();
  await expect(page.getByText(/now flies MAD–(BCN|LIS)/)).toBeVisible({ timeout: 30_000 });
  await expect(dialog).toHaveCount(0);

  expect(problems.pageErrors).toEqual([]);
});
