import type { Page } from "@playwright/test";
import { expect, gotoReady, test } from "./fixtures";

/**
 * Counts distinct colors in the map canvas, sampled on a sparse grid and
 * quantized to 5 bits per channel. A blank canvas (the Sept 2026 bug: the
 * MapLibre worker failed to load and the canvas stayed black) yields 1–2.
 * The screenshot is decoded in the page so no image library is needed.
 */
async function distinctCanvasColors(page: Page): Promise<number> {
  const canvas = page.locator(".globe-container canvas").first();
  const png = await canvas.screenshot();
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
    const colors = new Set<number>();
    for (let i = 0; i < data.length; i += 4 * 7) {
      colors.add(((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3));
      if (colors.size > 64) break;
    }
    return colors.size;
  }, png.toString("base64"));
}

test("world map renders content, not a blank canvas", async ({ page, problems }) => {
  await gotoReady(page, "/");
  await expect(page.locator(".globe-container canvas").first()).toBeVisible({ timeout: 30_000 });
  // Measure the map alone: hide every overlay (intro card, panels, toasts) so
  // UI drawn on top of the canvas can't make a blank map look "colorful".
  await page.addStyleTag({
    content:
      "* { visibility: hidden !important; } .globe-container canvas { visibility: visible !important; }",
  });

  await expect
    .poll(() => distinctCanvasColors(page), {
      message: "map canvas should show more than a flat color",
      timeout: 30_000,
      intervals: [1_000, 2_000],
    })
    // Measured with the offline basemap at 1440×900: healthy ≈ 36, worker missing = 4–6.
    .toBeGreaterThanOrEqual(16);

  expect(problems.pageErrors, "uncaught page errors").toEqual([]);
  expect(problems.badResponses, "same-origin HTTP failures").toEqual([]);
});
