import fs from "node:fs";
import path from "node:path";
import { expect, test } from "./fixtures";
import { createAirline, MADRID_PLAYER, navigateInApp } from "./signup";

test.use(MADRID_PLAYER);
// Measured one at a time: parallel runs compete for the CPU and skew the numbers.
test.describe.configure({ mode: "serial" });

/**
 * S54 perf probe: what idle play costs. An airline with one flying route sits
 * on the map while we count, over a fixed window:
 * - `requests`: moments the globe pushed a change that forces a redraw;
 * - `renders`: frames MapLibre actually drew;
 * - `draws`: WebGL draw calls;
 * - `longTaskMs`: main-thread time lost to tasks over 50 ms.
 * The sample is taken while the route's aircraft is in the air: game time is
 * stepped forward until the map starts uploading flight positions.
 * The headless browser renders WebGL in software, the slow case players
 * without GPU acceleration live in, so automatic mode runs in low power
 * there. A second run forces full mode to guard the one-clock cadence.
 *
 * Budgets (S54.4) are rates, not timings, so a slower CI machine doesn't
 * fail them; the long-task cost is logged for comparison only.
 */

const SAMPLE_MS = 15_000;

const PROBES = () => {
  const w = window as unknown as {
    __perf: { longTaskMs: number; longTasks: number; draws: number };
  };
  w.__perf = { longTaskMs: 0, longTasks: 0, draws: 0 };
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      w.__perf.longTasks++;
      w.__perf.longTaskMs += entry.duration;
    }
  }).observe({ type: "longtask" });
  for (const Ctx of [WebGLRenderingContext, WebGL2RenderingContext]) {
    for (const name of ["drawElements", "drawArrays"] as const) {
      const proto = Ctx.prototype as unknown as Record<string, (...args: unknown[]) => unknown>;
      const original = proto[name];
      proto[name] = function (this: unknown, ...args: unknown[]) {
        w.__perf.draws++;
        return original.apply(this, args);
      };
    }
  }
};

type Snapshot = {
  renders: number;
  requests: number;
  draws: number;
  longTaskMs: number;
  longTasks: number;
};

const snapshot = (page: import("@playwright/test").Page) =>
  page.evaluate((): Snapshot => {
    const w = window as unknown as {
      __perf: { longTaskMs: number; longTasks: number; draws: number };
      __acarsMapStats?: { renders: number; requests: number };
    };
    return {
      renders: w.__acarsMapStats?.renders ?? 0,
      requests: w.__acarsMapStats?.requests ?? 0,
      ...w.__perf,
    };
  });

type Mode = "auto" | "full";

/** Samples idle play mid-flight; returns per-second rates. */
async function measure(page: import("@playwright/test").Page, mode: Mode) {
  await page.addInitScript(PROBES);
  if (mode === "full") {
    await page.addInitScript(() => localStorage.setItem("acars_map_render_mode", "full"));
  }
  // Fake timers with time flowing normally, so we can jump to a departure.
  await page.clock.install();
  await createAirline(page);

  // One route; its aircraft flies once a day.
  await navigateInApp(page, "/airport/BCN");
  await page
    .getByTestId("route-decision-card")
    .getByRole("button", { name: /launch route with/i })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: /^launch$/i })
    .click();
  // Wait on the route list, not the 4-second "is live" toast: forced full
  // mode under software WebGL starves the page, and polling can miss a toast.
  // The toast can sit over the close button, and a pointer click waiting on it
  // hovers the toast, which pauses its dismissal: dispatch the click instead.
  await page
    .getByRole("button", { name: /close airport panel/i })
    .first()
    .dispatchEvent("click");
  await navigateInApp(page, "/network?tab=active");
  await expect(page.getByTestId("route-frequency").first()).toBeVisible({ timeout: 60_000 });
  await navigateInApp(page, "/");

  // Step game time until the aircraft is airborne (the clock uploads positions).
  const requests = () =>
    page.evaluate(
      () =>
        (window as unknown as { __acarsMapStats?: { requests: number } }).__acarsMapStats
          ?.requests ?? 0,
    );
  let airborne = false;
  for (let step = 0; step < 60 && !airborne; step++) {
    const start = await requests();
    await page.clock.fastForward("00:05:00");
    await page.waitForTimeout(1_500);
    airborne = (await requests()) > start;
  }
  expect(airborne).toBe(true);
  await page.waitForTimeout(2_000);

  const before = await snapshot(page);
  await page.waitForTimeout(SAMPLE_MS);
  const after = await snapshot(page);

  const seconds = SAMPLE_MS / 1000;
  const rate = (key: keyof Snapshot) =>
    Math.round(((after[key] - before[key]) / seconds) * 10) / 10;
  const lowPower = await page.evaluate(
    () =>
      (window as unknown as { __acarsMapStats?: { lowPower: boolean } }).__acarsMapStats?.lowPower,
  );
  const result = {
    mode,
    lowPower,
    requestsPerSecond: rate("requests"),
    rendersPerSecond: rate("renders"),
    drawsPerSecond: rate("draws"),
    longTaskMsPerSecond: rate("longTaskMs"),
    longTasksPerSecond: rate("longTasks"),
  };
  console.log("S54 perf probe", JSON.stringify(result));
  if (process.env.S54_PERF_OUT) {
    fs.writeFileSync(
      path.resolve(process.env.S54_PERF_OUT, `perf-probe-${mode}.json`),
      JSON.stringify(result),
    );
  }
  return result;
}

test("perf budget: software WebGL idles in low-power mode", async ({ page, problems }) => {
  test.setTimeout(240_000);
  const result = await measure(page, "auto");
  expect(result.lowPower).toBe(true);
  // One clock tick a second; MapLibre's GeoJSON round trip adds a frame per upload.
  expect(result.requestsPerSecond).toBeGreaterThan(0);
  expect(result.requestsPerSecond).toBeLessThanOrEqual(1.5);
  expect(result.rendersPerSecond).toBeLessThanOrEqual(3);
  expect(problems.pageErrors).toEqual([]);
});

test("perf budget: full mode redraws once per map-clock tick", async ({ page, problems }) => {
  test.setTimeout(240_000);
  const result = await measure(page, "full");
  expect(result.lowPower).toBe(false);
  // At most one redraw-forcing write per 200 ms tick (flights and flow together).
  expect(result.requestsPerSecond).toBeGreaterThan(0);
  expect(result.requestsPerSecond).toBeLessThanOrEqual(5.5);
  expect(problems.pageErrors).toEqual([]);
});
