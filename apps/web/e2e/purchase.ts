import { expect, type Page } from "@playwright/test";
import { navigateInApp } from "./signup";

/**
 * Real catalog photos come from Nostr/Blossom, which the fake relay doesn't
 * serve. A photo can't shrink like the fallback icon, so it is what pushed
 * the buy button out of the card: put a photo-sized image in every splash.
 */
async function giveCatalogPhotos(page: Page): Promise<void> {
  await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 800;
    const url = canvas.toDataURL();
    const splashes = document.querySelectorAll<HTMLElement>(
      "[data-testid=dealer-card] [data-testid=dealer-card-photo]",
    );
    for (const splash of Array.from(splashes)) {
      const img = document.createElement("img");
      img.src = url;
      img.className = "h-full w-full object-cover object-center";
      // Appended, not swapped: React still owns (and may update) the fallback.
      splash.append(img);
    }
  });
}

/**
 * A new player buys their first aircraft from the dealer: every card's buy
 * button sits inside its card, and the purchase goes through.
 */
export async function buyFirstAircraft(page: Page): Promise<void> {
  await navigateInApp(page, "/fleet");
  await page.getByRole("button", { name: /purchase aircraft/i }).click();
  const card = page.getByTestId("dealer-card").first();
  await expect(card).toBeVisible({ timeout: 30_000 });
  await giveCatalogPhotos(page);

  const buy = card.getByRole("button", { name: /configure & buy/i });
  // The list re-measures its rows once the photos are in: retry until it settles.
  await expect(async () => {
    const [cardBox, buyBox] = await Promise.all([card.boundingBox(), buy.boundingBox()]);
    if (!cardBox || !buyBox) throw new Error("dealer card not laid out");
    expect(buyBox.y + buyBox.height).toBeLessThanOrEqual(cardBox.y + cardBox.height);
    // Nothing in the card overflows it (the card clips).
    expect(
      await card.evaluate((element) => element.scrollHeight - element.clientHeight),
    ).toBeLessThanOrEqual(1);
  }).toPass({ timeout: 15_000 });

  await buy.click();
  const dialog = page.getByRole("dialog", { name: /ATR 42-600/ });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /confirm order/i }).click();
  await expect(page.getByText(/ATR 42-600 ordered/)).toBeVisible({ timeout: 30_000 });
  await expect(dialog).toHaveCount(0);
}
