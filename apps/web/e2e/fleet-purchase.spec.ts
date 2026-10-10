import { expect, test } from "./fixtures";
import { buyFirstAircraft } from "./purchase";
import { createAirline, MADRID_PLAYER } from "./signup";

test.use(MADRID_PLAYER);

// A new player could not buy a plane: with real catalog photos the dealer
// card outgrew its fixed list row and the buy button was cut off.
test("a new player buys their first aircraft", async ({ page, problems }) => {
  test.setTimeout(120_000);
  await createAirline(page);
  await buyFirstAircraft(page);
  await expect(page.getByText("ATR 42-600 1")).toBeVisible();
  await page.screenshot({ path: "test-results/fleet-purchase-desktop.png" });
  expect(problems.pageErrors).toEqual([]);
});
