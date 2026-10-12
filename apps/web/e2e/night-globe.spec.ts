import path from "node:path";
import type { Page } from "@playwright/test";
import { expect, gotoReady, test } from "./fixtures";

/** Warm (sodium-light) pixels in the map canvas, sampled on a sparse grid. */
async function warmPixels(page: Page): Promise<number> {
  const png = await page.locator(".globe-container canvas").first().screenshot();
  return page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const scratch = document.createElement("canvas");
    scratch.width = image.width;
    scratch.height = image.height;
    const context = scratch.getContext("2d");
    if (!context) return 0;
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, scratch.width, scratch.height);
    let warm = 0;
    for (let i = 0; i < data.length; i += 4 * 3) {
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      if (r > 120 && g > 70 && r - b > 60 && g - b > 25 && r >= g) warm += 1;
    }
    return warm;
  }, png.toString("base64"));
}

// S76: at 02:00 UTC Europe, Africa and the Americas are dark, and their cities glow.
test("cities light up on the night side of the globe", async ({ page, problems }) => {
  test.setTimeout(120_000);
  await page.clock.setFixedTime(new Date("2026-10-12T02:00:00Z"));
  // The whole globe over Europe and Africa (a saved view skips the fly-in).
  await page.addInitScript(() => {
    localStorage.setItem("acars_map_view", JSON.stringify({ center: [0, 25], zoom: 1.3 }));
  });
  await gotoReady(page, "/");
  await expect(page.locator(".globe-container canvas").first()).toBeVisible({ timeout: 30_000 });
  await page.addStyleTag({
    content:
      "* { visibility: hidden !important; } .globe-container canvas { visibility: visible !important; }",
  });
  await expect
    .poll(() => warmPixels(page), {
      message: "city lights should glow on the night side",
      timeout: 60_000,
      intervals: [1_000, 2_000],
    })
    .toBeGreaterThan(20);
  if (process.env.S76_SCREENSHOT) {
    await page.screenshot({
      path: path.resolve(process.env.S76_SCREENSHOT, `night-globe-${test.info().project.name}.png`),
    });
  }
  expect(problems.pageErrors).toEqual([]);
});
