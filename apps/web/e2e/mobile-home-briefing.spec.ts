import { expect, test } from "./fixtures";
import { createAirline, MADRID_PLAYER, navigateInApp } from "./signup";

test.use(MADRID_PLAYER);

// S56.1 on a phone: the briefing is a bottom sheet above the nav, and folds
// down to its summary so the globe has the screen.
test("mobile: the briefing is a bottom sheet that folds to its summary", async ({
  page,
  problems,
}) => {
  test.setTimeout(180_000);
  await createAirline(page);
  await navigateInApp(page, "/");

  const briefing = page.getByTestId("home-briefing");
  await expect(briefing).toBeVisible({ timeout: 30_000 });
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("no viewport");
  const open = await briefing.boundingBox();
  if (!open) throw new Error("no box");
  // A sheet: full width (bar the gutter), anchored at the bottom, at most 60% tall.
  expect(open.width).toBeGreaterThan(viewport.width - 40);
  expect(open.height).toBeLessThanOrEqual(viewport.height * 0.6 + 1);
  if (process.env.S56_SCREENSHOT) {
    await page.screenshot({ path: `${process.env.S56_SCREENSHOT}/home-briefing-phone.png` });
  }

  await briefing.getByRole("button", { name: "Hide the briefing" }).click();
  await expect(briefing).toHaveAttribute("data-open", "false");
  const folded = await briefing.boundingBox();
  if (!folded) throw new Error("no box");
  expect(folded.height).toBeLessThan(open.height);
  // Still sitting at the bottom of the screen.
  expect(folded.y + folded.height).toBeGreaterThan(viewport.height / 2);
  if (process.env.S56_SCREENSHOT) {
    await page.screenshot({
      path: `${process.env.S56_SCREENSHOT}/home-briefing-phone-folded.png`,
    });
  }
  expect(problems.pageErrors).toEqual([]);
});
