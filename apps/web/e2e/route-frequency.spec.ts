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
  // Launch flies a full schedule (S58): well above the old 7/wk, no idle warning.
  const weekly = async () =>
    Number(/(\d+)\/wk/.exec((await control.textContent()) ?? "")?.[1] ?? Number.NaN);
  await expect.poll(weekly, { timeout: 15_000 }).toBeGreaterThan(7);
  await expect(control.getByTestId("route-block-hours")).toContainText(/block h\/day per plane/);
  await expect(control.getByTestId("route-block-hours")).not.toContainText(/idle/);
  await expect(control.getByTestId("route-fly-more")).toHaveCount(0);
  const launched = await weekly();

  await control.getByRole("button", { name: /fewer round trips/i }).click();
  await control.getByRole("button", { name: /fewer round trips/i }).click();
  await control.getByRole("button", { name: "Apply" }).click();

  await expect(control).toContainText(`${launched - 2}/wk`);
  await expect(control.getByRole("button", { name: "Apply" })).toHaveCount(0);

  // Cut it to a few flights: the plane goes idle and "fly more" puts it back to work.
  const fewer = control.getByRole("button", { name: /fewer round trips/i });
  for (let i = 0; i < launched - 3; i++) await fewer.click();
  await control.getByRole("button", { name: "Apply" }).click();
  await expect(control).toContainText("1/wk");
  await expect(control.getByTestId("route-block-hours")).toContainText(/idle/);
  await control.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `test-results/s58-idle-${test.info().project.name}.png` });
  await control.getByTestId("route-fly-more").click();
  await expect(control.getByTestId("route-block-hours")).not.toContainText(/idle/);
  await expect(control.getByTestId("route-fly-more")).toHaveCount(0);
  expect(problems.pageErrors).toEqual([]);
});
