import fs from "node:fs";
import path from "node:path";
import { expect, gotoReady, test } from "./fixtures";

// One at a time: parallel runs compete for the CPU and skew the numbers.
test.describe.configure({ mode: "serial" });

/**
 * S45.2 perf probe for the globe prototype: with the camera orbiting (a full
 * redraw every frame), how many frames a second the browser manages at each
 * synthetic load, and what one plane-position update costs. Numbers go to
 * the S45 report (`S45_PERF_OUT` writes them as JSON). Headless Chromium
 * renders WebGL in software, so these are worst-case figures; only sanity is
 * asserted.
 */
const WARMUP_MS = 3_000;
const SAMPLE_MS = 10_000;

type Stats = { rafFrames: number; deckFrames: number; updateMs: number; planes: number };

const read = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const w = window as unknown as {
      __acarsPlayStats: { rafFrames: number; deckFrames: number; updateMs: number; planes: number };
      performance: Performance & { memory?: { usedJSHeapSize: number } };
    };
    return {
      ...w.__acarsPlayStats,
      heapMb: Math.round((w.performance.memory?.usedJSHeapSize ?? 0) / 1e6),
    };
  });

// 0 is the baseline: the globe and orbit alone, so the planes' own cost shows.
for (const load of [0, 1000, 10000, 50000]) {
  test(`globe prototype at ${load / 1000}k synthetic aircraft`, async ({ page, problems }) => {
    test.setTimeout(180_000);
    await gotoReady(page, `/play?prototype=on&load=${load}&orbit=1`);
    const globe = page.getByTestId("play-globe");
    await expect(globe).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
    if (load > 0) {
      await expect
        .poll(async () => Number(await globe.getAttribute("data-plane-count")), {
          timeout: 60_000,
        })
        .toBeGreaterThanOrEqual(load);
    }
    // The on-screen readout the owner uses on real devices.
    await expect(page.getByTestId("play-fps")).toContainText("fps", { timeout: 10_000 });
    await page.waitForTimeout(WARMUP_MS);

    const before: Stats = await read(page);
    await page.waitForTimeout(SAMPLE_MS);
    const after = await read(page);
    const seconds = SAMPLE_MS / 1000;
    const result = {
      load,
      planes: after.planes,
      fps: Math.round(((after.rafFrames - before.rafFrames) / seconds) * 10) / 10,
      deckFps: Math.round(((after.deckFrames - before.deckFrames) / seconds) * 10) / 10,
      updateMs: Math.round(after.updateMs * 10) / 10,
      heapMb: after.heapMb,
    };
    console.log("S45 perf", JSON.stringify(result));
    if (process.env.S45_PERF_OUT) {
      fs.writeFileSync(
        path.resolve(process.env.S45_PERF_OUT, `play-perf-${load}.json`),
        JSON.stringify(result),
      );
    }
    if (process.env.S45_SCREENSHOT) {
      await page.screenshot({
        path: path.resolve(process.env.S45_SCREENSHOT, `play-load-${load}.png`),
      });
    }
    expect(result.fps).toBeGreaterThan(0);
    if (load > 0) expect(result.deckFps).toBeGreaterThan(0);
    expect(problems.pageErrors).toEqual([]);
  });
}
