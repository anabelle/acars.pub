import { expect, test } from "./fixtures";

// Link previews (Slack, X, Discord, Nostr clients) read these tags from the
// static index.html, so they must be present without running any JS.
test("index.html ships complete share metadata", async ({ page, request }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const meta = await page.evaluate(() => {
    const read = (selector: string) =>
      document.head.querySelector<HTMLMetaElement>(selector)?.content?.trim() ?? "";
    return {
      title: document.title,
      description: read('meta[name="description"]'),
      ogTitle: read('meta[property="og:title"]'),
      ogDescription: read('meta[property="og:description"]'),
      ogImage: read('meta[property="og:image"]'),
      ogUrl: read('meta[property="og:url"]'),
      ogType: read('meta[property="og:type"]'),
      twitterCard: read('meta[name="twitter:card"]'),
      twitterImage: read('meta[name="twitter:image"]'),
      icon: document.head.querySelector<HTMLLinkElement>('link[rel="icon"]')?.getAttribute("href"),
    };
  });

  expect(meta.title).toMatch(/ACARS/);
  expect(meta.title).not.toMatch(/Corporate Console/);
  expect(meta.description.length).toBeGreaterThanOrEqual(50);
  expect(meta.description.length).toBeLessThanOrEqual(170);
  expect(meta.ogTitle).not.toBe("");
  expect(meta.ogDescription).not.toBe("");
  expect(meta.ogType).toBe("website");
  // Crawlers need absolute https URLs for og:url and og:image.
  expect(meta.ogUrl).toMatch(/^https:\/\//);
  expect(meta.ogImage).toMatch(/^https:\/\/.+\/og\.png$/);
  expect(meta.twitterCard).toBe("summary_large_image");
  expect(meta.twitterImage).toBe(meta.ogImage);

  // The image that production serves at that URL is the one shipped in this
  // build: check it exists locally, is a PNG, and has the 1200×630 OG size.
  const image = await request.get("/og.png");
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toContain("image/png");
  const size = await page.evaluate(async () => {
    const img = new Image();
    img.src = "/og.png";
    await img.decode();
    return { width: img.naturalWidth, height: img.naturalHeight };
  });
  expect(size).toEqual({ width: 1200, height: 630 });

  // The favicon must resolve to a real SVG (it used to point at a missing /vite.svg).
  expect(meta.icon).toBe("/favicon.svg");
  const icon = await request.get(meta.icon ?? "");
  expect(icon.status()).toBe(200);
  expect(icon.headers()["content-type"]).toContain("svg");
});
