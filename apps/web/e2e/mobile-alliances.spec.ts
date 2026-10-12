import path from "node:path";
import type { Browser, Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { launchRoute } from "./journeys";
import { sharedRelay } from "./sharedRelay";
import { createAirline, MADRID_PLAYER, navigateInApp } from "./signup";

test.use(MADRID_PLAYER);

async function shot(page: Page, name: string) {
  if (!process.env.S73_SCREENSHOT) return;
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.resolve(process.env.S73_SCREENSHOT, `${name}-${test.info().project.name}.png`),
  });
}

/** The airline page path of the player on `page` (from their own leaderboard row). */
async function ownAirlinePath(page: Page): Promise<string> {
  await navigateInApp(page, "/leaderboard");
  await page
    .locator("[data-index]")
    .filter({ hasText: /your airline/i })
    .getByTestId("leaderboard-airline-page")
    .click();
  await expect(page).toHaveURL(/\/airline\/npub1[0-9a-z]+$/, { timeout: 30_000 });
  return new URL(page.url()).pathname;
}

async function secondPlayer(browser: Browser, page: Page): Promise<Page> {
  const options = test.info().project.use;
  const context = await browser.newContext({
    ...MADRID_PLAYER,
    baseURL: options.baseURL,
    viewport: options.viewport ?? undefined,
    isMobile: options.isMobile,
    hasTouch: options.hasTouch,
    userAgent: options.userAgent,
    deviceScaleFactor: options.deviceScaleFactor,
  });
  // The first player's context has the default fake relay; this one gets only the shared one.
  void page;
  return context.newPage();
}

// S73: two players, one shared relay: one proposes, the other accepts, both are allies.
test("on a phone, two airlines become allies: one proposes, the other accepts", async ({
  page,
  browser,
  problems,
}) => {
  test.setTimeout(300_000);
  const relay = sharedRelay();
  await relay.attach(page);
  const other = await secondPlayer(browser, page);
  await relay.attach(other);

  await createAirline(page, { name: "Alpha Air" });
  await launchRoute(page, "BCN");
  await createAirline(other, { name: "Bravo Air" });
  await launchRoute(other, "LIS");
  const alphaPath = await ownAirlinePath(page);
  const bravoPath = await ownAirlinePath(other);

  // Alpha proposes on Bravo's page.
  await navigateInApp(page, bravoPath);
  const proposal = page.getByTestId("alliance-control");
  await expect(proposal).toHaveAttribute("data-status", "none", { timeout: 60_000 });
  await proposal.getByRole("button", { name: "Propose an alliance" }).click();
  await expect(proposal).toHaveAttribute("data-status", "proposed", { timeout: 30_000 });

  // Bravo sees the invitation on Alpha's page and accepts.
  await navigateInApp(other, alphaPath);
  const invitation = other.getByTestId("alliance-control");
  await expect(invitation).toHaveAttribute("data-status", "invited", { timeout: 60_000 });
  await shot(other, "alliance-invited");
  await invitation.getByRole("button", { name: "Accept the alliance" }).click();
  await expect(invitation).toHaveAttribute("data-status", "allied", { timeout: 30_000 });

  // Back on Bravo's page, Alpha sees the alliance too.
  await navigateInApp(page, "/leaderboard");
  await navigateInApp(page, bravoPath);
  await expect(page.getByTestId("alliance-control")).toHaveAttribute("data-status", "allied", {
    timeout: 60_000,
  });
  await shot(page, "alliance-allied");
  expect(problems.pageErrors).toEqual([]);
  await other.context().close();
});
