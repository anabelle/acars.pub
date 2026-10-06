import path from "node:path";
import { expect, test } from "./fixtures";
import { createAirline, MADRID_PLAYER, navigateInApp } from "./signup";

test.describe("signed-in player", () => {
  test.use(MADRID_PLAYER);

  test("opens their public airline page from the leaderboard", async ({ page, problems }) => {
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

    await navigateInApp(page, "/leaderboard");
    await page.getByTestId("leaderboard-airline-page").first().click();
    await expect(page).toHaveURL(/\/airline\/npub1[0-9a-z]+$/);
    const airline = page.getByTestId("public-airline");
    await expect(airline).toBeVisible({ timeout: 30_000 });
    await expect(airline.getByRole("heading", { name: "E2E Air" })).toBeVisible();
    await expect(page.getByTestId("airline-route-map").locator("line")).toHaveCount(1);
    if (process.env.S50_SCREENSHOT) {
      await page.screenshot({
        path: path.resolve(process.env.S50_SCREENSHOT, "public-airline.png"),
      });
    }
    expect(problems.pageErrors).toEqual([]);
  });
});

test("a guest following a link to an unknown airline gets the sign-up call to action", async ({
  page,
  problems,
}) => {
  await page.goto(
    "/airline/npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq",
  );
  await expect(page.getByTestId("public-airline-status")).toBeVisible({ timeout: 30_000 });
  await page.goto("/airline/" + "d".repeat(64));
  const status = page.getByTestId("public-airline-status");
  await expect(status).toContainText(/no airline found|looking up/i, { timeout: 30_000 });
  await expect(status.getByRole("link", { name: /start your own airline/i })).toBeVisible();
  expect(problems.pageErrors).toEqual([]);
});
