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
    // Known bug (ledger A12): on phones the absolutely positioned mobile top
    // bar is drawn over WorkspaceContextBar. S20 fixes it; when it does, this
    // starts passing and Playwright reports it, so S20 must delete this line.
    // See docs/overhaul/sessions/S20-front-door.md (step S20.1).
    test.fail(true, "Known overlap, fixed by overhaul session S20");

    await gotoReady(page, path);

    // No stable test ids exist yet (S01 adds no app code), so locate both bars
    // through their guest-mode content and take their containers.
    // The mobile top bar is a single full-width button ("Open identity").
    const topBar = page.getByRole("button", { name: "Open identity" }).first();
    // WorkspaceContextBar's root is the nearest bordered ancestor of its badge.
    const contextBar = page
      .getByText("Read-only mode", { exact: true })
      .first()
      .locator("xpath=ancestor::div[contains(@class,'border-b')][1]");

    const [topBox, contextBox] = await Promise.all([boxOf(topBar), boxOf(contextBar)]);
    expect(
      overlaps(topBox, contextBox),
      `top bar ${JSON.stringify(topBox)} vs context bar ${JSON.stringify(contextBox)}`,
    ).toBe(false);
  });
}
