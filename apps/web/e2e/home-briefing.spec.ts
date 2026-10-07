import { expect, test } from "./fixtures";
import { createAirline, MADRID_PLAYER, navigateInApp } from "./signup";

test.use(MADRID_PLAYER);

// S56.1 (D4 = A): the home view is the world with a briefing, not a panel.
test("the home map opens with the briefing, which folds and remembers it", async ({
  page,
  problems,
}) => {
  test.setTimeout(180_000);
  await createAirline(page);
  await navigateInApp(page, "/");

  const briefing = page.getByTestId("home-briefing");
  await expect(briefing).toBeVisible({ timeout: 30_000 });
  await expect(briefing).toHaveAttribute("data-open", "true");
  await expect(briefing.getByTestId("briefing-stats")).toContainText("Cash");
  await expect(briefing.getByTestId("briefing-next-landing")).toContainText("None in the air");
  // A new airline gets its first steps, today's objectives and the world's events.
  await expect(briefing.getByTestId("first-hour-checklist")).toBeVisible();
  await expect(briefing.getByTestId("daily-objectives")).toBeVisible();
  await expect(briefing.getByTestId("world-events")).toBeVisible();
  if (process.env.S56_SCREENSHOT) {
    await page.screenshot({ path: `${process.env.S56_SCREENSHOT}/home-briefing-desktop.png` });
  }

  // The cockpit carries the same cards: the briefing steps aside.
  await briefing.getByRole("link", { name: /open operator cockpit/i }).click();
  await expect(briefing).toHaveCount(0);
  await navigateInApp(page, "/");
  await expect(briefing).toBeVisible();

  // Folded, it keeps the summary, and stays folded after a reload.
  await briefing.getByRole("button", { name: "Hide the briefing" }).click();
  await expect(briefing).toHaveAttribute("data-open", "false");
  await expect(briefing.getByTestId("daily-objectives")).toHaveCount(0);
  await page.reload();
  await expect(briefing).toHaveAttribute("data-open", "false", { timeout: 30_000 });

  // Spanish.
  await page.evaluate(() => localStorage.setItem("acars-language", "es"));
  await page.reload();
  await expect(briefing.getByRole("button", { name: "Mostrar el resumen" })).toBeVisible({
    timeout: 30_000,
  });
  expect(problems.pageErrors).toEqual([]);
});
