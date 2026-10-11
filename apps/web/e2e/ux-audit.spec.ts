import { AUDITED_SCREENS, clippedControls } from "./clippedControls";
import { expect, gotoReady, test } from "./fixtures";
import { createAirline, MADRID_PLAYER, navigateInApp } from "./signup";

test.use(MADRID_PLAYER);

// No control on a main screen may be cut off (S57: buttons hidden outside
// their containers made it impossible to buy a plane).
test("no main-screen control is clipped on desktop", async ({ page }) => {
  test.setTimeout(240_000);
  await createAirline(page);
  const report: Record<string, string[]> = {};
  for (const path of AUDITED_SCREENS) {
    await navigateInApp(page, path);
    await page.waitForTimeout(1_000);
    report[path] = await clippedControls(page);
  }
  await gotoReady(page, "/kit");
  report["/kit"] = await clippedControls(page);
  expect(Object.fromEntries(Object.entries(report).filter(([, found]) => found.length))).toEqual(
    {},
  );
});

test("the audit catches a clipped control", async ({ page }) => {
  await gotoReady(page, "/kit");
  await page.evaluate(() => {
    const box = document.createElement("div");
    box.style.cssText = "position:fixed;top:10px;left:10px;width:80px;height:20px;overflow:hidden";
    box.innerHTML = '<button style="margin-top:40px">Planted</button>';
    document.body.append(box);
  });
  expect((await clippedControls(page)).some((line) => line.startsWith("Planted"))).toBe(true);
});
