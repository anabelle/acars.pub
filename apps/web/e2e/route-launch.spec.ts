import { expect, test } from "./fixtures";
import { createAirline, MADRID_PLAYER, navigateInApp } from "./signup";

test.use(MADRID_PLAYER);

test("a new player launches a route from the airport card", async ({ page, problems }) => {
  test.setTimeout(120_000);
  await createAirline(page);

  await navigateInApp(page, "/airport/BCN");
  const card = page.getByTestId("route-decision-card");
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(card.getByTestId("route-decision-profit")).toHaveText(/\/day/);

  await card.getByRole("button", { name: /launch route with/i }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText(/slot fee \$100,000/i);
  await dialog.getByRole("button", { name: /^launch$/i }).click();

  await expect(page.getByText(/MAD → BCN is live/)).toBeVisible({ timeout: 30_000 });
  // The route now has an aircraft, so the card has nothing left to launch.
  await expect(card.getByRole("button")).toHaveCount(0);
  await expect(card.getByRole("alert")).toHaveCount(0);

  expect(problems.pageErrors).toEqual([]);
});
