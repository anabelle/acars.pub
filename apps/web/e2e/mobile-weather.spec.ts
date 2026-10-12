import path from "node:path";
import { finalizeEvent, generateSecretKey, getPublicKey } from "nostr-tools/pure";
import { expect, gotoReady, test } from "./fixtures";

// S68: a weather bundle signed by the world's weather key, served by a fake relay.
test("on a phone, real weather from the world's weather key shows at the airport", async ({
  page,
  problems,
}) => {
  test.setTimeout(120_000);
  const now = Date.UTC(2026, 9, 12, 14, 30);
  const sk = generateSecretKey();
  const pubkey = getPublicKey(sk);
  // The bundle format of packages/nostr/src/weatherBundle.ts (kept inline: specs load as CJS).
  const dTag = "airtr:world:v6-beta:weather:2026101214";
  const bundle = finalizeEvent(
    {
      kind: 30078,
      created_at: Math.floor(now / 1000) - 25 * 60,
      tags: [
        ["d", dTag],
        ["world", "v6-beta"],
        ["t", "acars-weather"],
      ],
      content: JSON.stringify({
        v: 1,
        issued: new Date(now - 25 * 60_000).toISOString(),
        // [category, gust kt, flags: 1 TS, 2 FG, 4 SN]
        airports: { BCN: [0, 0, 0], MAD: [2, 38, 1] },
      }),
    },
    sk,
  );

  await page.clock.install({ time: new Date(now) });
  await page.addInitScript((key) => localStorage.setItem("acars_weather_pubkey", key), pubkey);
  await page.routeWebSocket(/^wss?:\/\//, (ws) => {
    ws.onMessage((raw) => {
      const message = JSON.parse(typeof raw === "string" ? raw : raw.toString());
      if (!Array.isArray(message)) return;
      const [type, sub, ...filters] = message;
      if (type === "REQ") {
        const wantsWeather = filters.some(
          (f: { authors?: string[]; "#d"?: string[] }) =>
            f.authors?.includes(pubkey) && f["#d"]?.includes(dTag),
        );
        if (wantsWeather) ws.send(JSON.stringify(["EVENT", sub, bundle]));
        ws.send(JSON.stringify(["EOSE", sub]));
      } else if (type === "EVENT" && sub && typeof sub === "object") {
        ws.send(JSON.stringify(["OK", sub.id, true, ""]));
      }
    });
  });

  await gotoReady(page, "/airport/MAD");
  const card = page.getByTestId("airport-weather");
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(card).toContainText("IFR · TS · G38");
  await expect(card).toContainText(/expect delays/);
  await card.scrollIntoViewIfNeeded();
  if (process.env.S68_SCREENSHOT) {
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.resolve(
        process.env.S68_SCREENSHOT,
        `airport-weather-${test.info().project.name}.png`,
      ),
    });
  }
  expect(problems.pageErrors).toEqual([]);
});
