import path from "node:path";
import { expect, test } from "./fixtures";
import { createAirline, MADRID_PLAYER, navigateInApp } from "./signup";

test.use(MADRID_PLAYER);

const shot = async (page: import("@playwright/test").Page, name: string) => {
  if (!process.env.S33_SCREENSHOT) return;
  await page
    .getByTestId("world-events")
    .screenshot({ path: path.resolve(process.env.S33_SCREENSHOT, name) });
};

// S33: the deterministic schedule puts a festival in Barcelona on the morning
// of 2026-10-08 (until 11:00 UTC). The cockpit lists it, flags it once the
// player flies MAD → BCN, and the status bar headlines it (en + es).
test("world events show in the cockpit and the status bar", async ({ page, problems }) => {
  test.setTimeout(180_000);
  await page.clock.install({ time: new Date("2026-10-08T06:00:00Z") });
  await createAirline(page);

  await navigateInApp(page, "/?panel=cockpit");
  const card = page.getByTestId("world-events");
  await card.scrollIntoViewIfNeeded();
  await expect(card).toContainText("What's happening", { timeout: 30_000 });
  const festival = card.getByTestId("world-event-festival").first();
  await expect(festival).toContainText("Festival");
  await expect(festival).toContainText("BCN");
  await expect(festival).toContainText("Demand +30%");
  await expect(festival).toHaveAttribute("data-affects-you", "false");
  await shot(page, "world-events-en.png");

  // Fly into the festival.
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
  await page
    .getByRole("button", { name: /close airport panel/i })
    .first()
    .click();

  await navigateInApp(page, "/?panel=cockpit");
  await card.scrollIntoViewIfNeeded();
  await expect(festival).toHaveAttribute("data-affects-you", "true", { timeout: 30_000 });
  await expect(festival).toContainText("Your routes: MAD–BCN");
  await shot(page, "world-events-yours-en.png");

  // The status bar headlines the event that touches the player.
  await expect(page.getByTestId("ticker-world-event")).toContainText("Festival · BCN");

  // Spanish.
  await page.evaluate(() => localStorage.setItem("acars-language", "es"));
  await page.reload();
  await navigateInApp(page, "/?panel=cockpit");
  await expect(card).toContainText("Qué está pasando", { timeout: 30_000 });
  await card.scrollIntoViewIfNeeded();
  await expect(card.getByTestId("world-event-festival").first()).toContainText("Demanda +30%");
  await shot(page, "world-events-es.png");

  expect(problems.pageErrors).toEqual([]);
});
