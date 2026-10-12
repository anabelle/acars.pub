import { finalizeEvent, generateSecretKey, getPublicKey } from "nostr-tools/pure";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mineRankProof, rankTemplate } from "./rankProof";

const sk = generateSecretKey();
const pubkey = getPublicKey(sk);
const events: object[] = [];
const filters: unknown[] = [];
const published: string[] = [];
let signer: object | null = {};
let weakenOnSign = false;

vi.mock("./ndk.js", () => ({
  ensureConnected: vi.fn().mockResolvedValue(undefined),
  getNDK: () => ({
    signer,
    subscribe: (filter: unknown) => {
      filters.push(filter);
      const handlers: Record<string, (value?: unknown) => void> = {};
      queueMicrotask(() => {
        for (const raw of events) handlers.event?.({ rawEvent: () => raw });
        handlers.eose?.();
      });
      return {
        on: (name: string, fn: (value?: unknown) => void) => {
          handlers[name] = fn;
        },
        stop: vi.fn(),
      };
    },
  }),
}));

vi.mock("@nostr-dev-kit/ndk", () => ({
  NDKEvent: class {
    raw: Record<string, unknown>;
    signed: { id: string } | null = null;
    constructor(_ndk: unknown, raw: Record<string, unknown>) {
      this.raw = raw;
    }
    async sign() {
      const rest = { ...this.raw };
      delete rest.pubkey;
      if (weakenOnSign) rest.created_at = (rest.created_at as number) + 1;
      this.signed = finalizeEvent(rest as never, sk);
    }
    rawEvent() {
      return this.signed;
    }
    get id() {
      return this.signed?.id ?? "";
    }
    async publish() {
      published.push(this.id);
    }
  },
}));

import { loadRankProofs, publishRankProof } from "./rank";

// The real bar (18 bits) takes seconds; the I/O layer is tested with mocked proofs.
vi.mock("@acars/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@acars/core")>()),
  RANKED_POW_BITS: 6,
}));

beforeEach(() => {
  events.length = 0;
  filters.length = 0;
  published.length = 0;
  signer = {};
  weakenOnSign = false;
});

async function proof() {
  const mined = await mineRankProof(rankTemplate(pubkey, 1_760_000_000, 6), { bits: 6 });
  const unsigned: Partial<typeof mined> = { ...mined };
  delete unsigned.id;
  return { mined, event: finalizeEvent(unsigned as never, sk) };
}

describe("loadRankProofs (S72)", () => {
  it("asks for the authors' proofs and keeps only valid ones from them", async () => {
    const { event } = await proof();
    const stranger = finalizeEvent({ ...event, pubkey: undefined } as never, generateSecretKey());
    const wire = (value: object) => JSON.parse(JSON.stringify(value));
    events.push(wire(event), { ...wire(event), sig: "00".repeat(64) }, wire(stranger));
    const ranked = await loadRankProofs([pubkey, pubkey, "nope"]);
    expect([...ranked]).toEqual([pubkey]);
    expect(filters[0]).toMatchObject({ kinds: [30078], authors: [pubkey] });
  });

  it("asks nothing for nobody, and batches many authors", async () => {
    expect((await loadRankProofs([])).size).toBe(0);
    expect(filters).toHaveLength(0);
    const many = Array.from({ length: 450 }, (_, i) => i.toString(16).padStart(64, "0"));
    await loadRankProofs(many);
    expect(filters).toHaveLength(3);
  });
});

describe("publishRankProof (S72)", () => {
  it("signs without losing the work and publishes", async () => {
    const { mined } = await proof();
    const id = await publishRankProof(mined);
    expect(published).toEqual([id]);
  });

  it("refuses without a signer, or when signing changed the id", async () => {
    const { mined } = await proof();
    signer = null;
    await expect(publishRankProof(mined)).rejects.toThrow("No signer");
    signer = {};
    // A signer that alters the event can't keep the work (almost surely).
    weakenOnSign = true;
    let failures = 0;
    for (let i = 0; i < 3; i++) {
      await publishRankProof(mined).catch(() => {
        failures += 1;
      });
    }
    expect(failures).toBeGreaterThan(0);
  });
});
