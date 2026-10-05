import { expect, type Page } from "@playwright/test";
import { gotoReady } from "./fixtures";

/**
 * Browser settings for a signed-up player whose home hub is Madrid (MAD):
 * the airline wizard picks the hub from the timezone and geolocation.
 */
export const MADRID_PLAYER = {
  timezoneId: "Europe/Madrid",
  geolocation: { latitude: 40.4722, longitude: -3.5608 },
  permissions: ["geolocation"],
};

/**
 * Creates a fresh airline through "Play for free" under the fake relay.
 * Use with `test.use(MADRID_PLAYER)` and a generous test timeout.
 *
 * The fake relay stores nothing, so a reload would forget the airline: after
 * this, move around with {@link navigateInApp} instead of `page.goto`.
 */
export async function createAirline(
  page: Page,
  { name = "E2E Air" }: { name?: string } = {},
): Promise<void> {
  await gotoReady(page, "/join");
  await page.getByRole("button", { name: /play for free/i }).click();
  // S21: the name is the only required field; code, callsign and colors are suggested.
  await page.locator("#airline-name").fill(name);
  await page.getByRole("button", { name: /launch airline/i }).click();
  await expect(page.locator("#airline-name")).toHaveCount(0, { timeout: 60_000 });
}

/** Client-side navigation (keeps the in-memory airline; see {@link createAirline}). */
export async function navigateInApp(page: Page, path: string): Promise<void> {
  await page.evaluate((target) => {
    window.history.pushState({}, "", target);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);
}
