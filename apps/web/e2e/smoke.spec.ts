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
