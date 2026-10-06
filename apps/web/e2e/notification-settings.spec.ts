import path from "node:path";
import { expect, test } from "./fixtures";
import { createAirline, MADRID_PLAYER, navigateInApp } from "./signup";

test.use({ ...MADRID_PLAYER, permissions: [...MADRID_PLAYER.permissions, "notifications"] });

const shot = async (page: import("@playwright/test").Page, name: string) => {
  if (!process.env.S34_SCREENSHOT) return;
  await page
    .getByTestId("notification-settings")
    .screenshot({ path: path.resolve(process.env.S34_SCREENSHOT, name) });
};

// S34: a player turns on alerts in the cockpit and picks categories (en + es).
test("a player turns on alerts and picks categories", async ({ page, problems }) => {
  test.setTimeout(180_000);
  await createAirline(page);
  await navigateInApp(page, "/?panel=cockpit");

  const card = page.getByTestId("notification-settings");
  await card.scrollIntoViewIfNeeded();
  await expect(card).toContainText("Alerts on this device");
  await shot(page, "notifications-off-en.png");

  await card.getByTestId("notifications-turn-on").click();
  const rivals = card.getByTestId("notification-category-rivals");
  await expect(rivals).toBeChecked();
  await rivals.uncheck();
  await shot(page, "notifications-on-en.png");
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem("acars:notifications") ?? "{}")),
  ).toMatchObject({ enabled: true, categories: { rivals: false, grounding: true } });

  // Spanish: the saved choices survive a reload.
  await page.evaluate(() => localStorage.setItem("acars-language", "es"));
  await page.reload();
  await navigateInApp(page, "/?panel=cockpit");
  await expect(card).toContainText("Alertas en este dispositivo", { timeout: 30_000 });
  await card.scrollIntoViewIfNeeded();
  await expect(card.getByTestId("notification-category-rivals")).not.toBeChecked();
  await shot(page, "notifications-on-es.png");

  expect(problems.pageErrors).toEqual([]);
});
