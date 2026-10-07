import { expect, test } from "./fixtures";
import { createAirline, MADRID_PLAYER, navigateInApp } from "./signup";

test.use({ ...MADRID_PLAYER, permissions: ["geolocation", "clipboard-read", "clipboard-write"] });

// S51 on desktop: no share sheet, so "Share my network" copies the public
// page link and offers the network image as a download.
test("desktop: share my network copies the link and offers the image", async ({
  page,
  problems,
}) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    // Desktop Chrome may expose a share sheet; this spec covers the fallback.
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
  });
  await createAirline(page);
  await navigateInApp(page, "/?panel=cockpit");

  await page.getByTestId("share-network").click();
  await expect(page.getByText("Link copied")).toBeVisible({ timeout: 30_000 });
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toMatch(/\/airline\/(npub1[0-9a-z]+)\?ref=\1$/);

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download image" }).click();
  expect((await download).suggestedFilename()).toMatch(/^acars-[a-z0-9]+-network\.png$/);

  expect(problems.pageErrors).toEqual([]);
});
