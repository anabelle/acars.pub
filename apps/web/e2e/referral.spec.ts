import { nip19 } from "nostr-tools";
import { expect, gotoReady, test } from "./fixtures";
import { createAirline, MADRID_PLAYER } from "./signup";

test.use(MADRID_PLAYER);

const REFERRER = "c".repeat(64);

// S51.3: a player who arrives through someone's `?ref=` link starts an
// airline; its AIRLINE_CREATE event names the referrer, which the S04
// funnel report counts.
test("a referral link is credited in the new airline's creation event", async ({ page }) => {
  test.setTimeout(120_000);
  const published: unknown[] = [];
  // A relay that answers like the shared fake one and records what's published.
  await page.routeWebSocket(/^wss?:\/\//, (ws) => {
    ws.onMessage((raw) => {
      let message: unknown;
      try {
        message = JSON.parse(typeof raw === "string" ? raw : raw.toString());
      } catch {
        return;
      }
      if (!Array.isArray(message)) return;
      const [type, first] = message as [string, { id?: string; content?: string }];
      if (type === "REQ" && typeof first === "string") ws.send(JSON.stringify(["EOSE", first]));
      if (type === "EVENT" && first?.id) {
        published.push(first);
        ws.send(JSON.stringify(["OK", first.id, true, ""]));
      }
    });
  });

  // Arrive through the link, then sign up (a later page load keeps the referrer).
  await gotoReady(page, `/?ref=${nip19.npubEncode(REFERRER)}`);
  await createAirline(page);

  await expect
    .poll(
      () =>
        published
          .map((event) => {
            try {
              return JSON.parse((event as { content: string }).content) as {
                action?: string;
                payload?: { referrer?: string };
              };
            } catch {
              return null;
            }
          })
          .find((content) => content?.action === "AIRLINE_CREATE")?.payload?.referrer,
    )
    .toBe(REFERRER);
});
