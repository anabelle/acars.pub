import type { Locator } from "@playwright/test";
import { expect, gotoReady, test } from "./fixtures";

type Box = { x: number; y: number; width: number; height: number };

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  if (!box) throw new Error("element has no bounding box (not rendered?)");
  return box;
}

for (const path of ["/", "/?panel=cockpit", "/join"]) {
  test(`mobile top bar and context bar don't overlap on ${path}`, async ({ page }) => {
    // Regression test for ledger A12 (fixed in overhaul S20.1): on phones the
    // floating top bar used to be drawn over WorkspaceContextBar.
    await gotoReady(page, path);

    // No stable test ids exist, so locate both bars through their guest-mode
    // content. The mobile top bar is a single full-width button.
    const topBar = page.getByRole("button", { name: "Open identity" }).first();
    // WorkspaceContextBar's root is the nearest bordered ancestor of its badge.
    const contextBar = page
      .getByText("Read-only mode", { exact: true })
      .first()
      .locator("xpath=ancestor::div[contains(@class,'border-b')][1]");

    // Both must exist, so a renamed label can't make this pass vacuously.
    await expect(topBar).toBeVisible();
    await expect(contextBar).toBeAttached();

    // The fix may hide the context bar on phones or move it; either way no
    // visible part of it may sit under the top bar.
    if (await contextBar.isVisible()) {
      const [topBox, contextBox] = await Promise.all([boxOf(topBar), boxOf(contextBar)]);
      expect(
        overlaps(topBox, contextBox),
        `top bar ${JSON.stringify(topBox)} vs context bar ${JSON.stringify(contextBox)}`,
      ).toBe(false);
    }
  });
}
