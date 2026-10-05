import { test as base, expect, type Page } from "@playwright/test";

/**
 * Shared e2e fixtures.
 *
 * - Every relay WebSocket is answered by an in-browser fake relay that knows
 *   no events: it ends each subscription with EOSE and acknowledges every
 *   published event. Tests therefore never touch real Nostr relays and always
 *   see the same empty world (guest mode must render without relays).
 * - `problems` collects uncaught page errors and same-origin HTTP failures
 *   (4xx/5xx or aborted), which is how a missing bundle file such as
 *   `maplibre/maplibre-gl-worker.mjs` shows up.
 */

export interface Problems {
  pageErrors: string[];
  badResponses: string[];
}

type Fixtures = {
  relayStub: void;
  problems: Problems;
};

export const test = base.extend<Fixtures>({
  relayStub: [
    async ({ context }, use) => {
      await context.routeWebSocket(/^wss?:\/\//, (ws) => {
        // Never call ws.connectToServer(): the socket stays fully mocked.
        ws.onMessage((raw) => {
          let message: unknown;
          try {
            message = JSON.parse(typeof raw === "string" ? raw : raw.toString());
          } catch {
            return;
          }
          if (!Array.isArray(message)) return;
          const [type, first] = message as [string, unknown];
          if (type === "REQ" && typeof first === "string") {
            ws.send(JSON.stringify(["EOSE", first]));
          } else if (type === "EVENT" && first && typeof first === "object" && "id" in first) {
            ws.send(JSON.stringify(["OK", (first as { id: string }).id, true, ""]));
          }
        });
      });
      await use();
    },
    { auto: true },
  ],

  problems: async ({ page, baseURL }, use) => {
    const origin = new URL(baseURL ?? "http://127.0.0.1").origin;
    const problems: Problems = { pageErrors: [], badResponses: [] };
    const sameOrigin = (url: string) => {
      try {
        return new URL(url).origin === origin;
      } catch {
        return false;
      }
    };

    page.on("pageerror", (error) => problems.pageErrors.push(error.message));
    page.on("response", (response) => {
      const url = response.url();
      if (!sameOrigin(url)) return;
      if (response.status() >= 400) {
        problems.badResponses.push(`${response.status()} ${url}`);
        return;
      }
      // The SPA fallback answers unknown paths with index.html and a 200, so a
      // missing module (e.g. the maplibre worker in Sept 2026) looks
      // "successful". Code and data assets must never come back as HTML.
      const path = new URL(url).pathname;
      const contentType = response.headers()["content-type"] ?? "";
      if (/\.(m?js|css|json|wasm)$/.test(path) && contentType.includes("text/html")) {
        problems.badResponses.push(`html-fallback ${url}`);
      }
    });
    page.on("requestfailed", (request) => {
      if (sameOrigin(request.url())) {
        problems.badResponses.push(`failed ${request.url()} (${request.failure()?.errorText})`);
      }
    });

    await use(problems);
  },
});

export { expect };

/** Navigate and wait until IdentityGate reports the app as ready. */
export async function gotoReady(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.documentElement.dataset.appReady === "true", null, {
    timeout: 30_000,
  });
}
