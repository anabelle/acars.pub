import { expect, test } from "./fixtures";
import { createAirline, MADRID_PLAYER, navigateInApp } from "./signup";

test.use(MADRID_PLAYER);

// S76: opt-in sound. Off by default; switching on plays a sample chime and sticks.
test("sound is off until switched on, and the switch is remembered", async ({ page, problems }) => {
  test.setTimeout(120_000);
  await createAirline(page);
  await navigateInApp(page, "/?panel=cockpit");
  const toggle = page.getByTestId("sound-toggle");
  await toggle.scrollIntoViewIfNeeded();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(toggle).toContainText(/sound on/i);

  await page.reload();
  const again = page.getByTestId("sound-toggle");
  await again.scrollIntoViewIfNeeded();
  await expect(again).toHaveAttribute("aria-pressed", "true", { timeout: 30_000 });
  expect(problems.pageErrors).toEqual([]);
});
