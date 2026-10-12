import path from "node:path";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { flyingAirline } from "./journeys";
import { MADRID_PLAYER, navigateInApp } from "./signup";

test.use(MADRID_PLAYER);

async function shot(page: Page, name: string) {
  if (!process.env.S70_SCREENSHOT) return;
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.resolve(process.env.S70_SCREENSHOT, `${name}-${test.info().project.name}.png`),
  });
}

/** Step the clock five minutes at a time until `ready` holds (a plane turns around). */
async function until(page: Page, ready: () => Promise<boolean>) {
  for (let i = 0; i < 40 && !(await ready()); i++) {
    await page.clock.fastForward("00:05:00");
    await page.waitForTimeout(400);
  }
  expect(await ready()).toBe(true);
}

// S70: flights fill toward departure, on the boards and in the plane panel.
test("on a phone, bookings climb toward departure on the boards and the plane panel", async ({
  page,
  problems,
}) => {
  test.setTimeout(400_000);
  await flyingAirline(page, { destinations: ["BCN", "LIS"], hours: 2 });

  await navigateInApp(page, "/fleet");
  await page.getByTestId("fleet-row").getByRole("button").filter({ hasText: /\S/ }).first().click();
  const card = page.getByTestId("next-departure-bookings");
  await until(page, () => card.isVisible());
  await expect(card).toContainText(/\d+ of \d+ seats sold/);
  await expect(card).toContainText(/more expected before departure/);
  await expect(card.getByTestId("booking-bar")).toHaveAttribute("data-filling", "true");
  await card.scrollIntoViewIfNeeded();
  await shot(page, "next-departure-bookings");

  await navigateInApp(page, "/airport/MAD?airportTab=flights");
  const filling = page.locator('[data-testid="booking-bar"][data-filling="true"]').first();
  await until(page, () => filling.isVisible());
  await expect(filling).toHaveAccessibleName(/\d+% ↑/);
  await filling.scrollIntoViewIfNeeded();
  await shot(page, "booking-bars-filling");
  expect(problems.pageErrors).toEqual([]);
});
