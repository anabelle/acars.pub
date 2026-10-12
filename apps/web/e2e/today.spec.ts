import path from "node:path";
import { expect, test } from "./fixtures";
import { flyingAirline } from "./journeys";
import { MADRID_PLAYER, navigateInApp } from "./signup";

test.use(MADRID_PLAYER);

// S62: the cockpit opens on the last 24 hours as a story, with four instruments.
test("the cockpit opens on today's story and the instruments", async ({ page, problems }) => {
  test.setTimeout(400_000);
  await flyingAirline(page, { destinations: ["BCN", "LIS"], hours: 6 });
  await navigateInApp(page, "/?panel=cockpit");

  const story = page.getByTestId("today-story");
  await expect(story).toBeVisible({ timeout: 30_000 });
  await expect(story.getByRole("heading", { name: /^Today · / })).toBeVisible();
  await expect(page.getByTestId("today-summary")).toContainText(/earned.*people flown.*landings/);
  await expect(page.getByTestId("chapter-delivery").first()).toBeVisible();
  await expect(page.getByTestId("chapter-bestFlight")).toBeVisible();

  const panel = page.getByTestId("instrument-panel");
  for (const id of ["utilization", "loadFactor", "margin", "runway"]) {
    await expect(panel.getByTestId(`instrument-${id}`)).not.toHaveAttribute("data-state", "none");
  }
  if (process.env.S62_SCREENSHOT) {
    await page.waitForTimeout(800);
    await page.screenshot({
      path: path.resolve(process.env.S62_SCREENSHOT, `today-${test.info().project.name}.png`),
    });
    await panel.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: path.resolve(process.env.S62_SCREENSHOT, `instruments-${test.info().project.name}.png`),
    });
  }
  expect(problems.pageErrors).toEqual([]);
});
