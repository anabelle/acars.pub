// Renders scripts/app-icon.html to the PWA icons in public/icons/ (S34),
// referenced by public/manifest.webmanifest and index.html. Run from
// apps/web after editing the HTML:
//   node scripts/render-app-icons.mjs
// Set CHROMIUM_PATH if Playwright's own Chromium isn't installed.
import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

const ICONS = [
  { file: "icon-192.png", size: 192, variant: "tile" },
  { file: "icon-512.png", size: 512, variant: "tile" },
  { file: "icon-maskable-512.png", size: 512, variant: "maskable" },
  { file: "apple-touch-icon.png", size: 180, variant: "maskable" },
];

const appDir = process.cwd();
const outDir = path.join(appDir, "public/icons");
await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  for (const icon of ICONS) {
    const page = await browser.newPage({ viewport: { width: icon.size, height: icon.size } });
    const url = pathToFileURL(path.join(appDir, "scripts/app-icon.html"));
    url.search = `?size=${icon.size}&variant=${icon.variant}`;
    await page.goto(url.href);
    await page
      .locator("#icon")
      .screenshot({ path: path.join(outDir, icon.file), omitBackground: true });
    await page.close();
    console.log(`wrote public/icons/${icon.file}`);
  }
} finally {
  await browser.close();
}
