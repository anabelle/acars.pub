import { expect, test } from "./fixtures";

/** Width and height from a PNG's IHDR chunk. */
function pngSize(bytes: Buffer): { width: number; height: number } {
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

// S34: the app is installable. Chrome's own check (the one behind the
// install prompt and Lighthouse's installability audit) must report no errors.
test("the app is installable", async ({ page, request }) => {
  await page.goto("/", { waitUntil: "load" });

  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(manifestHref).toBe("/manifest.webmanifest");
  const manifest = await (await request.get(manifestHref ?? "")).json();
  expect(manifest).toMatchObject({
    short_name: "ACARS",
    start_url: "/",
    display: "standalone",
  });

  // Every icon exists, is a PNG and has the size it declares; one is maskable.
  const icons = manifest.icons as Array<{ src: string; sizes: string; purpose: string }>;
  expect(icons.some((icon) => icon.purpose === "maskable")).toBe(true);
  for (const icon of icons) {
    const response = await request.get(icon.src);
    expect(response.ok(), icon.src).toBe(true);
    const [width, height] = icon.sizes.split("x").map(Number);
    expect(pngSize(await response.body()), icon.src).toEqual({ width, height });
  }
  const apple = await page.locator('link[rel="apple-touch-icon"]').getAttribute("href");
  expect((await request.get(apple ?? "")).ok()).toBe(true);

  const client = await page.context().newCDPSession(page);
  const { installabilityErrors } = await client.send("Page.getInstallabilityErrors");
  // Playwright's browser contexts are incognito-like, which Chrome always
  // reports; it is a property of the test browser, not of the app.
  const appErrors = installabilityErrors.filter((error) => error.errorId !== "in-incognito");
  expect(appErrors).toEqual([]);
});
