import path from "node:path";
import { expect, gotoReady, test } from "./fixtures";
import { createAirline, MADRID_PLAYER, navigateInApp } from "./signup";

test.use(MADRID_PLAYER);

const deckFrames = (page: import("@playwright/test").Page) =>
  page.evaluate(
    () =>
      (window as unknown as { __acarsPlayStats?: { deckFrames: number } }).__acarsPlayStats
        ?.deckFrames ?? 0,
  );

test("the globe prototype is off unless turned on", async ({ page, problems }) => {
  await gotoReady(page, "/play");
  await expect(page.getByTestId("play-disabled")).toContainText("Globe prototype is off");
  await expect(page.getByTestId("play-globe")).toHaveCount(0);
  expect(problems.pageErrors).toEqual([]);
});

// S45.1: the flagged /play route draws the player's real routes as deck.gl
// arcs on the MapLibre globe.
test("the globe prototype draws the player's routes as 3D arcs", async ({ page, problems }) => {
  test.setTimeout(180_000);
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

  await navigateInApp(page, "/play?prototype=on");
  const globe = page.getByTestId("play-globe");
  await expect(globe).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  await expect(globe).toHaveAttribute("data-arc-count", "1");
  await expect(page.getByTestId("play-route-summary")).toContainText("1 of your routes");
  // deck.gl is drawing into the globe's WebGL context.
  await expect.poll(() => deckFrames(page), { timeout: 30_000 }).toBeGreaterThan(0);
  if (process.env.S45_SCREENSHOT) {
    await page.waitForTimeout(3_000);
    await page.screenshot({ path: path.resolve(process.env.S45_SCREENSHOT, "play-arcs.png") });
  }

  // Back to the classic view.
  await page.getByRole("link", { name: "Classic view" }).click();
  await expect(page.getByTestId("play-shell")).toHaveCount(0);
  expect(problems.pageErrors).toEqual([]);
});
