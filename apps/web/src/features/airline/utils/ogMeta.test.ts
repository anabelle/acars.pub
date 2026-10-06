import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { WORLD_ID } from "@acars/nostr";
import { nip19 } from "nostr-tools";
import { describe, expect, it } from "vitest";
import {
  buildAirlineMeta,
  CHECKPOINT_D_TAG,
  decodeNpub,
  injectMeta,
  latestSummary,
  summarizeCheckpoint,
} from "./ogMeta";

const HEX = "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d";

describe("decodeNpub()", () => {
  it("matches nostr-tools and rejects bad input", () => {
    expect(decodeNpub(nip19.npubEncode(HEX))).toBe(HEX);
    expect(decodeNpub(HEX.toUpperCase())).toBe(HEX);
    const npub = nip19.npubEncode(HEX);
    expect(decodeNpub(`${npub.slice(0, -1)}${npub.endsWith("q") ? "p" : "q"}`)).toBeNull(); // checksum
    expect(decodeNpub(nip19.noteEncode(HEX))).toBeNull();
    expect(decodeNpub("npub1b!")).toBeNull();
    expect(decodeNpub("npub1qqqqqq")).toBeNull();
    expect(decodeNpub("npub1")).toBeNull();
  });
});

describe("checkpoint summaries", () => {
  it("tracks the game's world", () => {
    expect(CHECKPOINT_D_TAG).toBe(`airtr:world:${WORLD_ID}:checkpoint`);
  });

  const checkpoint = (name: string, extra: Record<string, unknown> = {}) =>
    JSON.stringify({
      airline: {
        name,
        icaoCode: "IBX",
        tier: 2,
        hubs: ["MAD"],
        livery: { primary: "#c8102e", accent: "not-a-colour" },
      },
      fleet: [{ id: "a" }, { id: "b", liveryImageUrl: "https://blossom/x.png" }],
      routes: [
        { status: "active", originIata: "MAD", destinationIata: "BCN" },
        { status: "suspended", originIata: "MAD", destinationIata: "LIS" },
      ],
      ...extra,
    });

  it("summarizes a checkpoint", () => {
    expect(summarizeCheckpoint(checkpoint("  Iberia Test  "))).toEqual({
      name: "Iberia Test",
      icaoCode: "IBX",
      tier: 2,
      aircraft: 2,
      routes: 1,
      hubs: ["MAD"],
      colors: { primary: "#c8102e", accent: "#fbbf24" },
      routeList: [{ originIata: "MAD", destinationIata: "BCN" }],
      liveryImageUrl: "https://blossom/x.png",
    });
  });

  it("rejects malformed content and tolerates missing parts", () => {
    expect(summarizeCheckpoint("{")).toBeNull();
    expect(summarizeCheckpoint("null")).toBeNull();
    expect(summarizeCheckpoint(JSON.stringify({ airline: { name: " " } }))).toBeNull();
    expect(summarizeCheckpoint(JSON.stringify({ airline: { name: "Bare" } }))).toMatchObject({
      name: "Bare",
      icaoCode: "",
      tier: 1,
      aircraft: 0,
      routes: 0,
      hubs: [],
      liveryImageUrl: null,
    });
  });

  it("picks the newest valid checkpoint", () => {
    const tags = [["d", CHECKPOINT_D_TAG]];
    expect(
      latestSummary([
        { created_at: 1, content: checkpoint("Old"), tags },
        { created_at: 3, content: "{", tags },
        { created_at: 2, content: checkpoint("New"), tags },
        { created_at: 9, content: checkpoint("Other tag"), tags: [["d", "x"]] },
      ])?.name,
    ).toBe("New");
    expect(latestSummary([])).toBeNull();
  });
});

describe("meta tags", () => {
  const html = readFileSync(resolve(__dirname, "../../../../index.html"), "utf8");
  const url = "https://acars.pub/airline/npub1x";
  const image = "https://acars.pub/api/og/airline/npub1x.png";

  it("describes an airline", () => {
    const meta = buildAirlineMeta(
      summarizeCheckpoint(
        JSON.stringify({
          airline: { name: "Iberia <Test>", icaoCode: "IBX", tier: 2, hubs: ["MAD"] },
          fleet: [{}],
          routes: [],
        }),
      ),
      url,
      image,
    );
    expect(meta.title).toBe("Iberia <Test> (IBX) on ACARS");
    expect(meta.description).toContain("1 aircraft · 0 routes · Tier 2 · hub MAD");
    const out = injectMeta(html, meta);
    expect(out.match(/<title>/g)).toHaveLength(1);
    expect(out).toContain("<title>Iberia &lt;Test&gt; (IBX) on ACARS</title>");
    expect(out.match(/property="og:title"/g)).toHaveLength(1);
    expect(out.match(/property="og:image"/g)).toHaveLength(1);
    expect(out.match(/name="twitter:image"/g)).toHaveLength(1);
    expect(out.match(/name="description"/g)).toHaveLength(1);
    expect(out).toContain(`<meta property="og:image" content="${image}" />`);
    expect(out).toContain(`<link rel="canonical" href="${url}" />`);
    // The app shell (script, root) is untouched.
    expect(out).toContain('<div id="root">');
  });

  it("falls back to a generic card without data", () => {
    const meta = buildAirlineMeta(null, url, image);
    expect(meta.title).toBe("An airline on ACARS");
    const noHub = buildAirlineMeta(
      summarizeCheckpoint(JSON.stringify({ airline: { name: "X" } })),
      url,
      image,
    );
    expect(noHub.title).toBe("X on ACARS");
    expect(noHub.description).not.toContain("hub");
  });
});
