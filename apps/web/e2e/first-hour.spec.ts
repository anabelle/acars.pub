import { expect, test } from "./fixtures";
import { createAirline, MADRID_PLAYER, navigateInApp } from "./signup";

test.use(MADRID_PLAYER);

// Guided first hour (overhaul S31): the cockpit checklist starts at "open a
// route", deep-links to where each step is done, and ticks itself off from
// airline state.
test("the first-hour checklist guides a new airline", async ({ page, problems }) => {
  test.setTimeout(120_000);
  await createAirline(page);

  await navigateInApp(page, "/?panel=cockpit");
  const checklist = page.getByTestId("first-hour-checklist");
  await expect(checklist).toBeVisible({ timeout: 30_000 });
  await expect(checklist).toContainText("0 of 5");
  await page.screenshot({ path: "test-results/checklist-0-start.png" });

  // The next step links to where it is done.
  await checklist.getByRole("link", { name: /find a route/i }).click();
  await expect(page).toHaveURL(/\/network\?tab=opportunities/);

  // Launch MAD → BCN from the airport panel.
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

  // Back to the cockpit, closing the airport panel first.
  await page
    .getByRole("button", { name: /close airport panel/i })
    .first()
    .click();
  await navigateInApp(page, "/?panel=cockpit");
  await expect(checklist).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("checklist-openRoute")).toHaveAttribute("data-done", "true");
  await expect(checklist).toContainText(/[12] of 5/);
  // The aircraft launched with the route is assigned: the next step says so.
  await expect(checklist).toContainText(/takes off once it's delivered|Land your first flight/);
  await page.screenshot({ path: "test-results/checklist-1-route-open.png" });
  expect(problems.pageErrors).toEqual([]);
});
