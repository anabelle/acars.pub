import { expect, test } from "./fixtures";
import { createAirline, MADRID_PLAYER, navigateInApp } from "./signup";

test.use(MADRID_PLAYER);

type MapTest = {
  __acarsMapTest?: {
    project: (lng: number, lat: number) => [number, number];
    jumpTo: (center: [number, number], zoom: number) => void;
  };
};

// S56.3 on a phone: tapping an airport opens its card as a bottom sheet.
test("mobile: an airport tapped on the globe answers in a bottom-sheet card", async ({
  page,
  problems,
}) => {
  test.setTimeout(180_000);
  await createAirline(page);
  await navigateInApp(page, "/?panel=map");
  await page.waitForFunction(() => Boolean((window as unknown as MapTest).__acarsMapTest));
  // Lisbon: clear of the folded briefing and the nav.
  await page.evaluate(() =>
    (window as unknown as MapTest).__acarsMapTest?.jumpTo([-9.13, 38.77], 5),
  );

  const card = page.getByTestId("airport-card");
  await expect(async () => {
    const [x, y] = await page.evaluate(
      () => (window as unknown as MapTest).__acarsMapTest?.project(-9.13, 38.77) ?? [0, 0],
    );
    await page.mouse.click(x, y);
    await expect(card).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  await expect(card).toHaveAttribute("data-iata", "LIS");

  const viewport = page.viewportSize();
  const box = await card.boundingBox();
  if (!viewport || !box) throw new Error("no geometry");
  expect(box.width).toBeGreaterThan(viewport.width - 40);
  expect(box.y + box.height).toBeGreaterThan(viewport.height / 2);
  if (process.env.S56_SCREENSHOT) {
    await page.screenshot({ path: `${process.env.S56_SCREENSHOT}/airport-card-phone.png` });
  }
  await card.getByRole("button", { name: "Close the airport card" }).click();
  await expect(card).toHaveCount(0);
  expect(problems.pageErrors).toEqual([]);
});
