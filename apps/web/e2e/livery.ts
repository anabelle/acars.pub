import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";

/** The test painting's bytes (also served as an uploaded image, S74). */
export const PAINTING_BYTES = readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "assets/test-livery.jpg"),
);
const PAINTING = PAINTING_BYTES.toString("base64");

/**
 * Serves a real painting for livery generation (the test environment has no
 * image model): the game's own catalog A220 photo, so screenshots show a plane
 * the way players see theirs. Returns how many paintings were requested.
 */
export async function stubLivery(page: Page): Promise<() => number> {
  let requests = 0;
  await page.route("**/api/generate-livery", async (route) => {
    requests += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ imageBase64: PAINTING, mimeType: "image/jpeg" }),
    });
  });
  return () => requests;
}

/**
 * Closes the delivery-day ceremony if it is showing (S61): a leased plane is
 * delivered minutes after a launch, and its welcome sits over the map until
 * the player continues, exactly as a real player would.
 */
export async function continuePastDelivery(page: Page): Promise<void> {
  const ceremony = page.getByTestId("delivery-ceremony");
  // Several planes can arrive together: each gets its own ceremony in turn.
  for (let i = 0; i < 8 && (await ceremony.isVisible().catch(() => false)); i++) {
    await ceremony.getByRole("button", { name: /^(continue|continuar)$/i }).click();
    await page.waitForTimeout(300);
  }
}
