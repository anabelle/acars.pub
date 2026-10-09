import { expect, test } from "./fixtures";
import { createAirline, MADRID_PLAYER, navigateInApp } from "./signup";

test.use(MADRID_PLAYER);

type MapTest = {
  __acarsMapTest?: {
    project: (lng: number, lat: number) => [number, number];
    jumpTo: (center: [number, number], zoom: number) => void;
  };
};

/** Midpoint of the great circle between two [lng, lat] points (where the arc is drawn). */
function greatCircleMidpoint(a: [number, number], b: [number, number]): [number, number] {
  const rad = Math.PI / 180;
  const toVec = ([lng, lat]: [number, number]) => [
    Math.cos(lat * rad) * Math.cos(lng * rad),
    Math.cos(lat * rad) * Math.sin(lng * rad),
    Math.sin(lat * rad),
  ];
  const [x, y, z] = toVec(a).map((v, i) => v + toVec(b)[i]);
  return [Math.atan2(y, x) / rad, Math.atan2(z, Math.hypot(x, y)) / rad];
}

// S56.2 and S56.3: what you click on the globe answers in one card style, in place.
test("route arcs and airports open cards in place, with doors to the full views", async ({
  page,
  problems,
}) => {
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
  await navigateInApp(page, "/?panel=map");

  // Centre the camera on the arc, close enough that it is well clear of both airports.
  const middle = greatCircleMidpoint([-3.56, 40.47], [2.08, 41.3]);
  await page.waitForFunction(() => Boolean((window as unknown as MapTest).__acarsMapTest));
  await page.evaluate(
    ([lng, lat]) => (window as unknown as MapTest).__acarsMapTest?.jumpTo([lng, lat], 6),
    middle,
  );
  const card = page.getByTestId("route-card");
  // The arc is drawn once the map has settled: retry the click until it lands.
  await expect(async () => {
    const [x, y] = await page.evaluate(
      ([lng, lat]) => (window as unknown as MapTest).__acarsMapTest?.project(lng, lat) ?? [0, 0],
      middle,
    );
    await page.mouse.click(x, y);
    await expect(card).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });

  await expect(card).toHaveAttribute("data-owner", "player");
  await expect(card).toContainText("MAD ⇄ BCN");
  await expect(card.getByTestId("route-card-owner")).toHaveText("Your route");
  await expect(card).toContainText("No landings yet");
  if (process.env.S56_SCREENSHOT) {
    await page.screenshot({ path: `${process.env.S56_SCREENSHOT}/route-card.png` });
  }

  // S56.3: an airport answers in the same card, with a door into the full panel.
  const airportCard = page.getByTestId("airport-card");
  await expect(async () => {
    const [x, y] = await page.evaluate(
      () => (window as unknown as MapTest).__acarsMapTest?.project(2.08, 41.3) ?? [0, 0],
    );
    await page.mouse.click(x, y);
    await expect(airportCard).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  // One card at a time.
  await expect(card).toHaveCount(0);
  await expect(airportCard).toHaveAttribute("data-iata", "BCN");
  await expect(airportCard.getByTestId("airport-card-routes")).toHaveText("1");
  await airportCard.getByRole("button", { name: "Open details" }).click();
  await expect(page).toHaveURL(/\/airport\/BCN/);
  await expect(airportCard).toHaveCount(0);
  await expect(page.getByRole("button", { name: /close airport panel/i }).first()).toBeVisible();

  // Back on the arc, the route card's door leads to fares and frequency.
  await navigateInApp(page, "/?panel=map");
  await page.evaluate(
    ([lng, lat]) => (window as unknown as MapTest).__acarsMapTest?.jumpTo([lng, lat], 6),
    middle,
  );
  await expect(async () => {
    const [x, y] = await page.evaluate(
      ([lng, lat]) => (window as unknown as MapTest).__acarsMapTest?.project(lng, lat) ?? [0, 0],
      middle,
    );
    await page.mouse.click(x, y);
    await expect(card).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  await card.getByRole("link", { name: "Fares & frequency" }).click();
  await expect(page).toHaveURL(/\/network\?tab=active/);
  await expect(card).toHaveCount(0);
  expect(problems.pageErrors).toEqual([]);
});
