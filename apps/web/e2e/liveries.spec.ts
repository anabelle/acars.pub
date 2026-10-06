import path from "node:path";
import { expect, test } from "./fixtures";
import { createAirline, MADRID_PLAYER, navigateInApp } from "./signup";

test.use(MADRID_PLAYER);

test("route rows and the hangar show aircraft liveries", async ({ page, problems }) => {
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

  await navigateInApp(page, "/network");
  const liveries = page.getByTestId("route-liveries").first();
  await expect(liveries).toBeVisible({ timeout: 30_000 });
  // No AI livery in the test environment: the silhouette fallback shows.
  await expect(liveries.getByTestId("livery-thumb")).toHaveCount(1);
  await expect(liveries.getByTestId("livery-thumb")).toHaveAttribute("data-has-image", "false");
  if (process.env.S44_SCREENSHOT) {
    await page.screenshot({ path: path.resolve(process.env.S44_SCREENSHOT, "route-liveries.png") });
  }

  // S44.2: the hangar gallery shows every aircraft as a livery tile.
  await navigateInApp(page, "/fleet");
  await page.getByRole("button", { name: /^hangar$/i }).click();
  const gallery = page.getByTestId("hangar-gallery");
  await expect(gallery).toBeVisible({ timeout: 30_000 });
  await expect(gallery.getByTestId("hangar-tile")).toHaveCount(1);
  await expect(gallery.getByTestId("hangar-tile")).toContainText("MAD → BCN");
  if (process.env.S44_SCREENSHOT) {
    await page.screenshot({ path: path.resolve(process.env.S44_SCREENSHOT, "hangar.png") });
  }

  // S44.3: the fleet poster renders identically each time, at both sizes.
  await page.getByTestId("open-fleet-poster").click();
  const canvas = page.getByTestId("fleet-poster-canvas");
  await expect(canvas).toHaveAttribute("data-ready", "true", { timeout: 15_000 });
  const portraitA = await canvas.evaluate((el) => (el as HTMLCanvasElement).toDataURL());
  await expect(canvas).toHaveJSProperty("width", 1080);
  if (process.env.S44_SCREENSHOT) {
    await canvas.screenshot({
      path: path.resolve(process.env.S44_SCREENSHOT, "poster-portrait.png"),
    });
  }
  await page.getByRole("button", { name: /landscape/i }).click();
  await expect(canvas).toHaveJSProperty("width", 1200);
  await expect(canvas).toHaveAttribute("data-ready", "true");
  if (process.env.S44_SCREENSHOT) {
    await canvas.screenshot({
      path: path.resolve(process.env.S44_SCREENSHOT, "poster-landscape.png"),
    });
  }
  await page.getByRole("button", { name: /portrait/i }).click();
  await expect(canvas).toHaveJSProperty("width", 1080);
  await expect(canvas).toHaveAttribute("data-ready", "true");
  const portraitB = await canvas.evaluate((el) => (el as HTMLCanvasElement).toDataURL());
  expect(portraitB).toBe(portraitA);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PNG" }).click();
  expect((await download).suggestedFilename()).toBe("e2e-air-fleet-1080x1350.png");

  expect(problems.pageErrors).toEqual([]);
});
