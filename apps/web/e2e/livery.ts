import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page } from "@playwright/test";

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
 * Closes all pending delivery-day ceremonies (S61): leased planes are
 * delivered minutes after a launch, and their welcomes sit over the map until
 * the player continues, exactly as a real player would.
 */
export async function continuePastDelivery(page: Page): Promise<void> {
  const ceremony = page.getByTestId("delivery-ceremony");
  // DeliveryCeremony renders only the queue head; closing it mounts the next plane's dialog.
  // Drain until none remain, rather than stopping after an arbitrary number of aircraft.
  await expect
    .poll(
      async () => {
        if (await ceremony.count()) {
          await ceremony
            .getByRole("button", { name: /^(continue|continuar)$/i })
            .click({ timeout: 2_000 });
        }
        return ceremony.count();
      },
      { timeout: 30_000, message: "all pending delivery ceremonies should be dismissed" },
    )
    .toBe(0);
}
