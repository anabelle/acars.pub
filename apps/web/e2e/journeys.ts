import { expect, type Page } from "@playwright/test";
import { continuePastDelivery, stubLivery } from "./livery";
import { createAirline, navigateInApp } from "./signup";

/** Launches hub → destination from the airport card and waits until it is live. */
export async function launchRoute(page: Page, destination: string): Promise<void> {
  await navigateInApp(page, `/airport/${destination}`);
  const card = page.getByTestId("route-decision-card");
  await expect(card).toBeVisible({ timeout: 30_000 });
  await card.getByRole("button", { name: /launch route with/i }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: /^launch$/i })
    .click();
  await expect(page.getByText(new RegExp(`→ ${destination} is live`))).toBeVisible({
    timeout: 30_000,
  });
}

/**
 * A Madrid airline that has been flying for a while (S62): routes launched,
 * planes delivered (ceremonies closed), then `hours` of game time in 20-minute
 * steps so the timeline holds real landings. Needs `test.use(MADRID_PLAYER)`.
 */
export async function flyingAirline(
  page: Page,
  { destinations = ["BCN"], hours = 2 }: { destinations?: string[]; hours?: number } = {},
): Promise<void> {
  await page.clock.install();
  await stubLivery(page);
  await createAirline(page);
  for (const destination of destinations) await launchRoute(page, destination);
  await page.clock.fastForward("00:05:00");
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(400);
    await continuePastDelivery(page);
  }
  for (let step = 0; step < hours * 3; step++) {
    await page.clock.fastForward("00:20:00");
    await page.waitForTimeout(300);
    await continuePastDelivery(page);
  }
  const later = page.getByRole("button", { name: /not now/i });
  if (await later.isVisible().catch(() => false)) await later.click();
}
