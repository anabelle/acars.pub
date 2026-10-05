import { expect, gotoReady, test } from "./fixtures";
import { GUEST_ROUTES } from "./routes";

// Each guest route must boot with no uncaught errors, no same-origin 4xx/5xx
// or HTML-fallback assets (missing bundle or worker files), and no router
// error screen.
for (const { path } of GUEST_ROUTES) {
  test(`boots ${path}`, async ({ page, problems }) => {
    await gotoReady(page, path);
    // Give lazy route chunks, workers and the map a moment to load.
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);

    await expect(page.locator("body")).toContainText("ACARS");
    await expect(page.locator("body")).not.toContainText("Something went wrong");
    expect(problems.pageErrors, "uncaught page errors").toEqual([]);
    expect(problems.badResponses, "same-origin HTTP failures").toEqual([]);
  });
}

// `/join` is a standalone entry page (overhaul S20.3): one call to action and
// none of the HUD chrome (top bar auth cluster, sidebar, ticker) around it.
test("/join is an entry page with a single call to action", async ({ page }) => {
  await gotoReady(page, "/join");
  await expect(page.getByRole("button", { name: /play/i })).toHaveCount(1);
  await expect(page.getByRole("button", { name: /browser wallet/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /^fleet$/i })).toHaveCount(0);
  await expect(page.locator('[data-layout="entry"]')).toHaveCount(1);
});

// Honest landing (overhaul S20.4): unshipped mechanics may only appear inside
// the labelled roadmap section, never as live features.
test("/join only mentions planned features inside the roadmap", async ({ page }) => {
  await gotoReady(page, "/join");
  const body = page.locator("body");
  await expect(body).not.toContainText("Earn real Bitcoin");
  await expect(body).not.toContainText("Run a real corporation");
  await expect(body).not.toContainText("Earn Bitcoin");

  const roadmap = page.locator('section[aria-labelledby="join-roadmap-title"]');
  await expect(roadmap).toContainText("On the roadmap");
  const outsideRoadmap = await page.evaluate(() => {
    const clone = document.body.cloneNode(true) as HTMLElement;
    clone.querySelector('section[aria-labelledby="join-roadmap-title"]')?.remove();
    return clone.textContent ?? "";
  });
  expect(outsideRoadmap).not.toMatch(/\bIPO|takeover|Bitcoin|sats\b|zaps?\b/i);
});
