import { nip19 } from "nostr-tools";
import { describe, expect, it, vi } from "vitest";
import {
  handleAirlinePage,
  loadSummaryFromRelays,
  ogImageUrl,
  onRequestGet,
  readCheckpointEvents,
} from "../../../../../../functions/airline/[npub]";
import { CHECKPOINT_D_TAG } from "./ogMeta";

const HEX = "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d";
const NPUB = nip19.npubEncode(HEX);
const SHELL = `<!doctype html><html><head><title>ACARS</title>
<meta property="og:title" content="ACARS" /></head><body><div id="root"></div></body></html>`;
const summary = {
  name: "Iberia Test",
  icaoCode: "IBX",
  tier: 2,
  aircraft: 3,
  routes: 2,
  hubs: ["MAD"],
  colors: { primary: "#c8102e", accent: "#ffcc00" },
  routeList: [],
  liveryImageUrl: null,
};
const checkpointEvent = (name: string, created_at = 1) => ({
  created_at,
  content: JSON.stringify({ airline: { name } }),
  tags: [["d", CHECKPOINT_D_TAG]],
});

describe("handleAirlinePage()", () => {
  const request = new Request(`https://acars.pub/airline/${NPUB}`);
  const fetchAsset = vi.fn<(url: URL) => Promise<Response>>(async () => new Response(SHELL));

  it("serves the app shell with the airline's preview tags", async () => {
    const loadSummary = vi.fn(async () => summary);
    const response = await handleAirlinePage(request, NPUB, { fetchAsset, loadSummary });
    const html = await response.text();
    expect(loadSummary).toHaveBeenCalledWith(HEX);
    expect(fetchAsset.mock.calls[0]?.[0].toString()).toBe("https://acars.pub/index.html");
    expect(html).toContain("<title>Iberia Test (IBX) on ACARS</title>");
    expect(html).toContain(`content="${ogImageUrl("https://acars.pub", NPUB)}"`);
    expect(html).toContain('<div id="root"></div>');
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("cache-control")).toBe("public, max-age=300");
  });

  it("falls back to a generic card for bad keys, missing data or relay errors", async () => {
    const bad = await handleAirlinePage(request, "nonsense", { fetchAsset, loadSummary: vi.fn() });
    expect(await bad.text()).toContain("<title>An airline on ACARS</title>");
    expect(bad.headers.get("cache-control")).toBe("public, max-age=60");
    const failing = await handleAirlinePage(request, NPUB, {
      fetchAsset,
      loadSummary: async () => {
        throw new Error("relay down");
      },
    });
    expect(await failing.text()).toContain("An airline on ACARS");
  });
});

describe("relay reading", () => {
  function fakeRelay(frames: (subId: string) => unknown[], opts: { close?: boolean } = {}) {
    const listeners: Record<string, Array<(event: { data: unknown }) => void>> = {};
    const socket = {
      accept: vi.fn(),
      close: vi.fn(),
      addEventListener: (type: string, listener: (event: { data: unknown }) => void) => {
        listeners[type] = [...(listeners[type] ?? []), listener];
      },
      send: (data: string) => {
        const subId = JSON.parse(data)[1] as string;
        queueMicrotask(() => {
          for (const frame of frames(subId)) {
            for (const l of listeners.message ?? [])
              l({ data: typeof frame === "string" ? frame : JSON.stringify(frame) });
          }
          if (opts.close) for (const l of listeners.close ?? []) l({ data: null });
        });
      },
    };
    const fetchImpl = vi.fn(async () => Object.assign(new Response(null), { webSocket: socket }));
    return { socket, fetchImpl };
  }

  it("collects events until EOSE", async () => {
    const { socket, fetchImpl } = fakeRelay((sub) => [
      "not json",
      ["NOTICE", "hi"],
      ["EVENT", "other-sub", checkpointEvent("Wrong")],
      ["EVENT", sub, checkpointEvent("Right")],
      ["EOSE", sub],
    ]);
    const events = await readCheckpointEvents("wss://relay.test", HEX, fetchImpl, 1000);
    expect(fetchImpl).toHaveBeenCalledWith("https://relay.test", {
      headers: { Upgrade: "websocket" },
    });
    expect(socket.accept).toHaveBeenCalled();
    expect(events.map((e) => JSON.parse(e.content).airline.name)).toEqual(["Right"]);
    expect(socket.close).toHaveBeenCalled();
  });

  it("gives up on timeout, close, failed fetch or no socket", async () => {
    const silent = fakeRelay(() => []);
    expect(await readCheckpointEvents("wss://r", HEX, silent.fetchImpl, 5)).toEqual([]);
    const closing = fakeRelay(() => [], { close: true });
    expect(await readCheckpointEvents("wss://r", HEX, closing.fetchImpl, 1000)).toEqual([]);
    expect(
      await readCheckpointEvents("wss://r", HEX, async () => {
        throw new Error("blocked");
      }),
    ).toEqual([]);
    expect(await readCheckpointEvents("wss://r", HEX, async () => new Response(null))).toEqual([]);
  });

  it("tries relays in order until one has the airline", async () => {
    const read = vi.fn(async (relay: string) => (relay === "b" ? [checkpointEvent("Found")] : []));
    expect((await loadSummaryFromRelays(HEX, ["a", "b", "c"], read))?.name).toBe("Found");
    expect(read).toHaveBeenCalledTimes(2);
    expect(await loadSummaryFromRelays(HEX, ["a"], async () => [])).toBeNull();
  });
});

describe("onRequestGet()", () => {
  it("wires the Pages context (cache miss with an empty relay set)", async () => {
    const put = vi.fn(async () => {});
    vi.stubGlobal("caches", { default: { match: vi.fn(async () => undefined), put } });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null)),
    );
    const waitUntil = vi.fn();
    const response = await onRequestGet({
      request: new Request(`https://acars.pub/airline/${NPUB}`),
      params: { npub: [NPUB] },
      env: { ASSETS: { fetch: async () => new Response(SHELL) } },
      waitUntil,
    });
    expect(await response.text()).toContain("An airline on ACARS");
    expect(waitUntil).toHaveBeenCalled();
    expect(put).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("serves a cached summary", async () => {
    vi.stubGlobal("caches", {
      default: { match: vi.fn(async () => new Response(JSON.stringify(summary))), put: vi.fn() },
    });
    const response = await onRequestGet({
      request: new Request(`https://acars.pub/airline/${NPUB}`),
      params: { npub: NPUB },
      env: { ASSETS: { fetch: async () => new Response(SHELL) } },
      waitUntil: vi.fn(),
    });
    expect(await response.text()).toContain("Iberia Test (IBX) on ACARS");
    vi.unstubAllGlobals();
  });
});
