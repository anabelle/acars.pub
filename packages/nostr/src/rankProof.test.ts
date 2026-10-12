import { powBits } from "@acars/core";
import { finalizeEvent, generateSecretKey, getPublicKey } from "nostr-tools/pure";
import { describe, expect, it } from "vitest";
import { mineRankProof, parseRankProof, RANK_D_TAG, rankTemplate } from "./rankProof";

const sk = generateSecretKey();
const pubkey = getPublicKey(sk);
const BITS = 8;

async function signedProof(bits = BITS) {
  const mined = await mineRankProof(rankTemplate(pubkey, 1_760_000_000, bits), { bits });
  const unsigned: Partial<typeof mined> = { ...mined };
  delete unsigned.id;
  return { mined, event: finalizeEvent(unsigned as never, sk) };
}

describe("rank proofs (S72)", () => {
  it("mines a nonce whose id carries the work, and signing keeps it", async () => {
    const progress: number[] = [];
    const mined = await mineRankProof(rankTemplate(pubkey, 1_760_000_000, BITS), {
      bits: BITS,
      chunk: 50,
      onProgress: (n) => progress.push(n),
    });
    expect(powBits(mined.id)).toBeGreaterThanOrEqual(BITS);
    expect(mined.tags).toContainEqual(["d", RANK_D_TAG]);
    const { event } = await signedProof();
    expect(powBits(event.id)).toBeGreaterThanOrEqual(BITS);
    expect(parseRankProof(event, BITS)).toBe(pubkey);
    expect(progress.every((n, i) => i === 0 || n > progress[i - 1])).toBe(true);
  });

  it("stops when cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      mineRankProof(rankTemplate(pubkey, 1, 64), {
        bits: 64,
        chunk: 10,
        signal: controller.signal,
      }),
    ).rejects.toThrow("Mining cancelled");
    await expect(
      mineRankProof({ ...rankTemplate(pubkey, 1), tags: [["d", RANK_D_TAG]] }, { bits: 1 }),
    ).rejects.toThrow("no nonce tag");
  });

  it("rejects proofs that are forged, weak, or for something else", async () => {
    // A plain copy, like an event off the wire (nostr-tools caches verification on the object).
    const event = JSON.parse(JSON.stringify((await signedProof()).event));
    expect(parseRankProof(event, BITS + 16)).toBeNull(); // not enough work for the bar
    expect(parseRankProof({ ...event, kind: 1 }, BITS)).toBeNull();
    expect(parseRankProof({ ...event, sig: undefined }, BITS)).toBeNull();
    expect(parseRankProof({ ...event, sig: "00".repeat(64) }, BITS)).toBeNull();
    expect(parseRankProof({ ...event, sig: "zz" }, BITS)).toBeNull();
    expect(parseRankProof({ ...event, pubkey: "a".repeat(64) }, BITS)).toBeNull();
    expect(parseRankProof({ ...event, tags: [["d", "other"]] }, BITS)).toBeNull();
    expect(
      parseRankProof(
        { ...event, tags: event.tags.map((t) => (t[0] === "nonce" ? [t[0], t[1], "1"] : t)) },
        BITS,
      ),
    ).toBeNull(); // commitment below the bar
    expect(parseRankProof({ ...event, tags: undefined }, BITS)).toBeNull();
  });
});
