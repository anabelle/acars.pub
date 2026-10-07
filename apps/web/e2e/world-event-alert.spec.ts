import { expect, test } from "./fixtures";
import { createAirline, MADRID_PLAYER, navigateInApp } from "./signup";

test.use(MADRID_PLAYER);

/**
 * A stand-in Notification API that records what the app shows, alerts already
 * turned on, no service worker in the way, and a page we can mark as out of
 * view. Browsers differ on all of these (CI's headless shell has no usable
 * Notification permission); what this spec checks is the app's decision.
 */
const ALERTS_IN_BACKGROUND = () => {
  const shown: { title: string; body?: string }[] = [];
  (window as unknown as { __shown: typeof shown }).__shown = shown;
  class FakeNotification {
    static permission = "granted";
    static async requestPermission() {
      return "granted";
    }
    constructor(title: string, options?: NotificationOptions) {
      shown.push({ title, body: options?.body });
    }
  }
  Object.defineProperty(window, "Notification", { value: FakeNotification, configurable: true });
  if (navigator.serviceWorker) {
    Object.defineProperty(navigator.serviceWorker, "getRegistration", {
      value: async () => undefined,
      configurable: true,
    });
  }
  Object.defineProperty(document, "visibilityState", {
    get: () => ((window as unknown as { __hidden?: boolean }).__hidden ? "hidden" : "visible"),
    configurable: true,
  });
  localStorage.setItem("acars:notifications", JSON.stringify({ enabled: true, categories: {} }));
};

// S55.4: the deterministic schedule starts a festival in Barcelona at
// 2026-10-06 09:00 UTC. A Madrid airline flying MAD → BCN, with ACARS in the
// background, gets a system notification when it starts.
test("a world event starting on one of your routes notifies in the background", async ({
  page,
  problems,
}) => {
  test.setTimeout(180_000);
  await page.addInitScript(ALERTS_IN_BACKGROUND);
  await page.clock.install({ time: new Date("2026-10-06T08:45:00Z") });
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

  const shown = () =>
    page.evaluate(() => (window as unknown as { __shown: { title: string }[] }).__shown);
  expect(await shown()).toEqual([]);

  // The player switches away; the festival starts a quarter of an hour later.
  await page.evaluate(() => {
    (window as unknown as { __hidden: boolean }).__hidden = true;
  });
  await page.clock.fastForward("20:00");
  await expect.poll(shown, { timeout: 60_000 }).toContainEqual({
    title: "Event on your routes",
    body: "Festival at BCN has just started. Your routes: MAD–BCN.",
  });

  expect(problems.pageErrors).toEqual([]);
});
