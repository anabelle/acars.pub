import { createHash } from "node:crypto";
import path from "node:path";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { launchRoute } from "./journeys";
import { continuePastDelivery, PAINTING_BYTES, stubLivery } from "./livery";
import { createAirline, MADRID_PLAYER, navigateInApp } from "./signup";

test.use(MADRID_PLAYER);

async function shot(page: Page, name: string) {
  if (!process.env.S74_SCREENSHOT) return;
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.resolve(process.env.S74_SCREENSHOT, `${name}-${test.info().project.name}.png`),
  });
}

// S74: the livery reveal can be posted (opt-in, previewed), and the ranking narrows to friends.
test("on a phone, a player posts the livery reveal and ranks the people they follow", async ({
  page,
  problems,
}) => {
  test.setTimeout(240_000);
  await page.clock.install();
  await stubLivery(page);
  // Blossom (S74): the painting "uploads" and is served back, so the plane gets a public image URL.
  await page.route("https://blossom.primal.net/**", async (route) => {
    const request = route.request();
    if (request.method() === "PUT") {
      const body = request.postDataBuffer() ?? Buffer.alloc(0);
      const sha256 = createHash("sha256").update(body).digest("hex");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          url: `https://blossom.primal.net/${sha256}.png`,
          sha256,
          size: body.length,
          type: "image/png",
          uploaded: Math.floor(Date.now() / 1000),
        }),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: "image/jpeg", body: PAINTING_BYTES });
  });
  await createAirline(page);
  await launchRoute(page, "BCN");

  const ceremony = page.getByTestId("delivery-ceremony");
  for (let i = 0; i < 10 && !(await ceremony.isVisible().catch(() => false)); i++) {
    await page.clock.fastForward("00:02:00");
    await page.waitForTimeout(500);
  }
  await expect(ceremony).toBeVisible({ timeout: 30_000 });
  await ceremony.getByTestId("post-reveal").click();
  const preview = page.getByTestId("reveal-post-dialog");
  await expect(preview).toContainText("Post the livery reveal");
  await expect(preview.getByLabel("Text")).toHaveValue(/^Meet .+, our new .+, home at MAD\./);
  await expect(preview.getByTestId("reveal-post-dialog-image")).toBeVisible();
  await shot(page, "reveal-post");
  await preview.getByRole("button", { name: "Post", exact: true }).click();
  await expect(page.getByText("Posted to Nostr")).toBeVisible({ timeout: 30_000 });
  await expect(preview).toHaveCount(0);
  await navigateInApp(page, "/leaderboard");
  const league = page.getByTestId("leaderboard-league");
  await expect(league).toBeVisible();
  await continuePastDelivery(page);
  await expect(ceremony).toHaveCount(0);
  await league.getByRole("button", { name: "People I follow" }).click();
  await expect(league.getByRole("button", { name: "People I follow" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  // Nobody followed in a fresh key: your own airline still shows.
  await expect(page.getByTestId("leaderboard-empty")).toHaveCount(0, { timeout: 30_000 });
  await expect(page.locator('[data-index="0"]').getByText("E2E Air")).toBeVisible();
  await shot(page, "friends-league");
  expect(problems.pageErrors).toEqual([]);
});
