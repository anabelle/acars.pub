// Renders scripts/og-image.html to public/og.png (1200×630), the link-preview
// image referenced by index.html. Run from apps/web after editing the HTML:
//   node scripts/render-og-image.mjs
// Set CHROMIUM_PATH if Playwright's own Chromium isn't installed.
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

const appDir = process.cwd();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.goto(pathToFileURL(path.join(appDir, "scripts/og-image.html")).href);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(appDir, "public/og.png") });
} finally {
  await browser.close();
}
console.log("wrote public/og.png");
