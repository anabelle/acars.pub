import { expect, test } from "@playwright/test";

test("home boots without uncaught errors", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/", { waitUntil: "domcontentloaded" });
  // IdentityGate flips this once identity resolution leaves "checking".
  await page.waitForFunction(() => document.documentElement.dataset.appReady === "true", null, {
    timeout: 30_000,
  });

  await expect(page.locator("body")).toContainText("ACARS");
  expect(pageErrors).toEqual([]);
});
