import path from "node:path";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { launchRoute } from "./journeys";
import { createAirline, MADRID_PLAYER, navigateInApp } from "./signup";

test.use(MADRID_PLAYER);

async function shot(page: Page, name: string) {
  if (!process.env.S71_SCREENSHOT) return;
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.resolve(process.env.S71_SCREENSHOT, `${name}-${test.info().project.name}.png`),
  });
}

// S71: who flies a route sets how price-sensitive it is — seen on the card and in the fare editor.
test("each route shows who flies it and how they take a fare rise", async ({ page, problems }) => {
  test.setTimeout(180_000);
  await createAirline(page);
  await launchRoute(page, "BCN");

  await navigateInApp(page, "/network?tab=active");
  const who = page.getByTestId("who-flies").first();
  await expect(who).toBeVisible({ timeout: 30_000 });
  await expect(who).toContainText(
    /Who flies: \d+% holiday-makers · \d+% visiting family · \d+% business\./,
  );
  await expect(who).toHaveAttribute("data-tone", /sensitive|balanced|forgiving/);

  await page
    .getByRole("button", { name: /edit fares/i })
    .first()
    .click();
  // The editor (a portal after the list) shows the same line.
  await expect(page.getByTestId("who-flies")).toHaveCount(2);
  const editorWho = page.getByTestId("who-flies").last();
  await expect(editorWho).toContainText("Who flies:");
  await editorWho.scrollIntoViewIfNeeded();
  await shot(page, "who-flies");
  expect(problems.pageErrors).toEqual([]);
});
