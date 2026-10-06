import path from "node:path";
import { expect, test } from "./fixtures";
import { createAirline, MADRID_PLAYER, navigateInApp } from "./signup";

test.use(MADRID_PLAYER);

test("turns on fleet auto-maintenance and shows the next service", async ({ page, problems }) => {
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

  await navigateInApp(page, "/fleet");
  const control = page.getByTestId("maintenance-policy");
  await expect(control).toBeVisible({ timeout: 30_000 });
  const row = page.getByTestId("aircraft-maintenance").first();
  await expect(row).toContainText(/grounds in ~\d+ days/i);

  const toggle = control.getByRole("switch", { name: /auto-maintenance/i });
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect(row).toContainText(/next service in ~\d+ days/i);
  await expect(row.getByRole("combobox")).toContainText(/fleet default \(on\)/i);

  if (process.env.S13_SCREENSHOT) {
    await page.screenshot({
      path: path.resolve(process.env.S13_SCREENSHOT, "auto-maintenance.png"),
    });
  }
  expect(problems.pageErrors).toEqual([]);
});
