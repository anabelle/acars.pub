import { expect, gotoReady, test } from "./fixtures";

// Honest status bar (overhaul S22.2): a UTC clock, and a LIVE dot that
// follows the real relay connection instead of always glowing green.

test("the status bar shows UTC time and goes live with relays up", async ({ page, problems }) => {
  await gotoReady(page, "/");
  await expect(page.getByTestId("ticker-clock")).toHaveText(/^\d{2}:\d{2}$/, { timeout: 30_000 });
  const live = page.getByTestId("ticker-live");
  await expect(live).toHaveAttribute("data-status", "ready", { timeout: 30_000 });
  await expect(live).toContainText(/live/i);
  expect(problems.pageErrors).toEqual([]);
});

test("the LIVE dot turns amber when relays are down", async ({ page }) => {
  test.setTimeout(90_000);
  // Page-level routes win over the shared fake relay: every relay refuses.
  await page.routeWebSocket(/^wss?:\/\//, (ws) => {
    ws.close({ code: 1011, reason: "relay down (e2e)" });
  });
  await gotoReady(page, "/");
  const live = page.getByTestId("ticker-live");
  await expect(live).toBeVisible({ timeout: 30_000 });
  await expect(live).not.toHaveAttribute("data-status", "ready");
  await expect(live).toHaveAttribute("data-status", "offline", { timeout: 45_000 });
  await expect(live).toHaveClass(/text-amber-400/);
  await expect(live).toContainText(/offline/i);
});
