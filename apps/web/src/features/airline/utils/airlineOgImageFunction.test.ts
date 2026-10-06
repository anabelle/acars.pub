import { nip19 } from "nostr-tools";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  handleAirlineImage,
  IMAGE_TTL_S,
  onRequestGet,
} from "../../../../../../functions/api/og/airline/[npub]";
import type { AirlineSummary } from "./ogMeta";

const HEX = "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d";
const NPUB = nip19.npubEncode(HEX);
const FALLBACK = new Uint8Array([1, 2, 3]);
const summary: AirlineSummary = {
  name: "Iberia Test",
  icaoCode: "IBX",
  tier: 2,
  aircraft: 3,
  routes: 1,
  hubs: ["MAD"],
  colors: { primary: "#c8102e", accent: "#ffcc00" },
  routeList: [{ originIata: "MAD", destinationIata: "BCN" }],
  liveryImageUrl: null,
};

const request = (npub: string) => new Request(`https://acars.pub/api/og/airline/${npub}`);
const deps = (overrides: Partial<Parameters<typeof handleAirlineImage>[2]> = {}) => ({
  fetchAsset: vi.fn<(url: URL) => Promise<Response>>(async () => new Response(FALLBACK)),
  loadSummary: vi.fn<(pubkey: string) => Promise<AirlineSummary | null>>(async () => summary),
  renderPng: vi.fn<(s: AirlineSummary) => Promise<Uint8Array<ArrayBuffer>>>(
    async () => new Uint8Array([9, 9]),
  ),
  ...overrides,
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("handleAirlineImage()", () => {
  it("renders the airline's card and caches it", async () => {
    const d = deps();
    const response = await handleAirlineImage(request(NPUB), NPUB, d);
    expect(d.loadSummary).toHaveBeenCalledWith(HEX);
    expect(d.renderPng).toHaveBeenCalledWith(summary);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe(`public, max-age=${IMAGE_TTL_S}`);
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([9, 9]);
  });

  it.each([
    ["a bad key", "npub1nope", {}],
    ["a missing airline", NPUB, { loadSummary: vi.fn(async () => null) }],
    [
      "a relay failure",
      NPUB,
      {
        loadSummary: vi.fn(async () => {
          throw new Error("down");
        }),
      },
    ],
    [
      "a render failure",
      NPUB,
      {
        renderPng: vi.fn(async () => {
          throw new Error("boom");
        }),
      },
    ],
  ])("falls back to the generic image on %s", async (_label, npub, overrides) => {
    const d = deps(overrides);
    const response = await handleAirlineImage(request(npub), npub, d);
    expect(d.fetchAsset).toHaveBeenCalledWith(new URL("https://acars.pub/og.png"));
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("public, max-age=60");
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([...FALLBACK]);
  });
});

describe("onRequestGet()", () => {
  const context = (npub: string | string[]) => ({
    request: request(Array.isArray(npub) ? npub[0] : npub),
    params: { npub },
    env: { ASSETS: { fetch: async () => new Response(FALLBACK) } },
    waitUntil: vi.fn(),
  });

  it("serves a cached image without touching relays", async () => {
    const hit = new Response(new Uint8Array([7]), { headers: { "content-type": "image/png" } });
    vi.stubGlobal("caches", { default: { match: vi.fn(async () => hit), put: vi.fn() } });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const response = await onRequestGet(context(NPUB));
    expect(response).toBe(hit);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("renders from the cached summary and stores the PNG", async () => {
    const put = vi.fn(async () => {});
    const match = vi.fn(async (key: Request) =>
      key.url.includes("/airline/") ? new Response(JSON.stringify(summary)) : undefined,
    );
    vi.stubGlobal("caches", { default: { match, put } });
    const ctx = context([NPUB]);
    const response = await onRequestGet(ctx);
    expect(response.headers.get("content-type")).toBe("image/png");
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect([...bytes.subarray(0, 4)]).toEqual([137, 80, 78, 71]);
    expect(put).toHaveBeenCalledTimes(1);
    expect(ctx.waitUntil).toHaveBeenCalled();
  });

  it("serves the fallback when there is no cache and no npub", async () => {
    vi.stubGlobal("caches", undefined);
    const response = await onRequestGet({ ...context(NPUB), params: {} });
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([...FALLBACK]);
  });
});
