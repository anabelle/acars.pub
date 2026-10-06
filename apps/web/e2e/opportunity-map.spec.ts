import path from "node:path";
import { expect, test } from "./fixtures";
import { createAirline, MADRID_PLAYER } from "./signup";

test.use(MADRID_PLAYER);

/**
 * Records the opportunity worker's main-thread cost: how long each
 * postMessage (structured clone of the request) and each reply handler take.
 * Installed before the app loads; only the opportunities worker is wrapped.
 */
const WORKER_PROBE = () => {
  const NativeWorker = window.Worker;
  const probe = { posts: [] as number[], replies: [] as number[], created: 0 };
  (window as unknown as { __opportunityProbe: typeof probe }).__opportunityProbe = probe;
  window.Worker = class extends NativeWorker {
    constructor(url: string | URL, options?: WorkerOptions) {
      super(url, options);
      if (!String(url).includes("opportunities")) return;
      probe.created++;
      const post = this.postMessage.bind(this);
      this.postMessage = (message: unknown, transfer?: unknown) => {
        const start = performance.now();
        post(message, transfer as Transferable[]);
        probe.posts.push(performance.now() - start);
      };
      let handler: ((event: MessageEvent) => void) | null = null;
      Object.defineProperty(this, "onmessage", {
        get: () => handler,
        set: (fn: ((event: MessageEvent) => void) | null) => {
          handler = fn;
          super.onmessage = fn
            ? (event: MessageEvent) => {
                const start = performance.now();
                fn(event);
                probe.replies.push(performance.now() - start);
              }
            : null;
        },
      });
    }
  } as typeof Worker;
};

test("the opportunity map is computed off the main thread", async ({ page, problems }) => {
  test.setTimeout(180_000);
  await page.addInitScript(WORKER_PROBE);
  await createAirline(page);

  const toggle = page.getByTestId("opportunities-toggle");
  await expect(toggle).toBeVisible({ timeout: 30_000 });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");

  await toggle.click();
  const legend = page.getByTestId("opportunity-legend");
  await expect(legend).toContainText("Opportunities from MAD");
  // The worker answers (the key replaces "Computing…").
  await expect(legend).toContainText(/green earns/i, { timeout: 60_000 });

  const probe = await page.evaluate(
    () =>
      (
        window as unknown as {
          __opportunityProbe: { posts: number[]; replies: number[]; created: number };
        }
      ).__opportunityProbe,
  );
  expect(probe.created).toBe(1);
  expect(probe.posts.length).toBeGreaterThan(0);
  expect(probe.replies.length).toBeGreaterThan(0);
  // The main thread only clones the request and stores the reply.
  expect(Math.max(...probe.posts)).toBeLessThan(50);
  expect(Math.max(...probe.replies)).toBeLessThan(50);
  console.log("S43 opportunity main-thread ms", JSON.stringify(probe));

  if (process.env.S43_SCREENSHOT) {
    await page.waitForTimeout(1_500);
    await page.screenshot({
      path: path.resolve(process.env.S43_SCREENSHOT, "opportunity-map.png"),
    });
  }

  // Turning it off clears the layer and remembers the choice.
  await toggle.click();
  await expect(legend).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("acars_map_show_opportunities"))).toBe(
    "false",
  );

  expect(problems.pageErrors).toEqual([]);
});
