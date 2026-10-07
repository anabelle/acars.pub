import path from "node:path";
import { expect, gotoReady, test } from "./fixtures";
import { createAirline, MADRID_PLAYER, navigateInApp } from "./signup";

test.use(MADRID_PLAYER);
// S45_VIDEO=1 records the run (the S45.3 screen recording).
test.use({ video: process.env.S45_VIDEO ? "on" : "off" });

/** Clicks the globe where a surface point is (via the prototype's test hook). */
async function clickLngLat(page: import("@playwright/test").Page, lng: number, lat: number) {
  const [x, y] = await page.evaluate(
    ([a, b]) =>
      (
        window as unknown as { __acarsPlayProject: (lng: number, lat: number) => [number, number] }
      ).__acarsPlayProject(a, b),
    [lng, lat] as const,
  );
  await page.mouse.click(x, y);
}

const shot = async (page: import("@playwright/test").Page, name: string) => {
  if (!process.env.S45_SCREENSHOT) return;
  await page.waitForTimeout(1_500);
  await page.screenshot({ path: path.resolve(process.env.S45_SCREENSHOT, name) });
};

const deckFrames = (page: import("@playwright/test").Page) =>
  page.evaluate(
    () =>
      (window as unknown as { __acarsPlayStats?: { deckFrames: number } }).__acarsPlayStats
        ?.deckFrames ?? 0,
  );

test("?boot=1 shows the startup trace", async ({ page, problems }) => {
  await gotoReady(page, "/play?prototype=on&boot=1");
  const trace = page.getByTestId("boot-trace");
  await expect(trace).toContainText("app: script started");
  await expect(trace).toContainText("play: globe loaded", { timeout: 60_000 });
  await expect(trace).toContainText("long tasks:");
  expect(problems.pageErrors).toEqual([]);
});

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
  await shot(page, "play-arcs.png");

  // S45.3: click the airport, the route and empty space for contextual cards.
  const card = page.getByTestId("play-card");
  await page.waitForTimeout(1_000);
  await clickLngLat(page, 2.08, 41.3);
  await expect(card).toHaveAttribute("data-kind", "airport");
  await expect(card).toContainText("BCN");
  await expect(card).toContainText("1 of your routes");
  await shot(page, "play-card-airport.png");

  // 12% of the way along MAD → BCN: the arc is still near the ground there
  // (the hook projects surface points), and clear of Madrid's dot.
  await clickLngLat(page, -2.88, 40.57);
  await expect(card).toHaveAttribute("data-kind", "route");
  await expect(card).toContainText("Your route");
  await expect(card).toContainText("MAD → BCN");
  await expect(card).toContainText("E2E Air");
  await shot(page, "play-card-route.png");

  await card.getByRole("button", { name: "Close" }).click();
  await expect(card).toHaveCount(0);

  // The briefing drawer: today's numbers plus the cockpit's own cards.
  await page.getByRole("button", { name: "Briefing" }).click();
  const briefing = page.getByTestId("play-briefing");
  await expect(briefing).toContainText("Today's briefing");
  await expect(briefing).toContainText("Cash");
  await expect(briefing.getByTestId("world-events")).toBeVisible();
  await expect(briefing.getByTestId("daily-objectives")).toBeVisible();
  await shot(page, "play-briefing.png");
  await briefing.getByRole("button", { name: "Close the briefing" }).click();
  await expect(briefing).toHaveCount(0);

  // Back to the classic view.
  await page.getByRole("link", { name: "Classic view" }).click();
  await expect(page.getByTestId("play-shell")).toHaveCount(0);
  expect(problems.pageErrors).toEqual([]);
});
