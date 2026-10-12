import path from "node:path";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { launchRoute } from "./journeys";
import { createAirline, MADRID_PLAYER, navigateInApp } from "./signup";

test.use(MADRID_PLAYER);

async function shot(page: Page, name: string) {
  if (!process.env.S72_SCREENSHOT) return;
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.resolve(process.env.S72_SCREENSHOT, `${name}-${test.info().project.name}.png`),
  });
}

// S72: a few seconds of real proof of work in the page ranks the airline.
test("a player gets ranked with a few seconds of computer work", async ({ page, problems }) => {
  test.setTimeout(240_000);
  await createAirline(page);
  // The board lists airlines with activity: open a route first.
  await launchRoute(page, "BCN");

  await navigateInApp(page, "/leaderboard");
  const card = page.getByTestId("get-ranked");
  await expect(card).toHaveAttribute("data-status", "unranked", { timeout: 30_000 });
  await expect(card).toContainText("can't undercut the suggested fare");
  await shot(page, "get-ranked");

  await card.getByRole("button", { name: /get ranked/i }).click();
  await expect(card).toHaveAttribute("data-status", /mining|publishing|ranked/);
  await expect(card).toHaveAttribute("data-status", "ranked", { timeout: 180_000 });
  await expect(card).toContainText("Ranked: your airline counts in the ranking.");
  await expect(page.getByTestId("leaderboard-ranked").first()).toBeVisible({ timeout: 30_000 });
  await shot(page, "ranked");
  expect(problems.pageErrors).toEqual([]);
});
