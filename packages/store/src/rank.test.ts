import type { FlightOffer } from "@acars/core";
import { fp, getSuggestedFares } from "@acars/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mine = vi.fn();
const publish = vi.fn();
vi.mock("@acars/nostr", () => ({
  rankTemplate: (pubkey: string, createdAt: number) => ({ pubkey, created_at: createdAt }),
  mineRankProof: (...args: unknown[]) => mine(...args),
  publishRankProof: (...args: unknown[]) => publish(...args),
}));

import { offersInForce } from "./FlightEngine";
import { cancelRankMining, getRanked, isRankedAirline, useRankStore } from "./rank";

const ME = "a".repeat(64);

beforeEach(() => {
  useRankStore.setState({ ranked: new Set(), loaded: false, status: "unknown", hashes: 0 });
  mine.mockReset();
  publish.mockReset();
});

describe("rank store (S72)", () => {
  it("counts everyone as ranked until proofs load, then only provers", () => {
    expect(isRankedAirline("x")).toBe(true);
    useRankStore.getState().setRanked(["y"], ME);
    expect(isRankedAirline("x")).toBe(false);
    expect(isRankedAirline("y")).toBe(true);
    expect(useRankStore.getState().status).toBe("unranked");
    useRankStore.getState().setRanked([ME], ME);
    expect(useRankStore.getState().status).toBe("ranked");
  });

  it("leaves the player's status alone without a key", () => {
    useRankStore.getState().setRanked(["y"]);
    expect(useRankStore.getState().status).toBe("unknown");
    useRankStore.getState().setStatus("failed");
    useRankStore.getState().setRanked(["z"], ME);
    expect(useRankStore.getState().status).toBe("failed");
  });
});

describe("getRanked (S72)", () => {
  it("mines with progress, publishes, and ranks the player", async () => {
    mine.mockImplementation(async (_template, options: { onProgress: (n: number) => void }) => {
      options.onProgress(4000);
      expect(useRankStore.getState()).toMatchObject({ status: "mining", hashes: 4000 });
      return { id: "proof" };
    });
    publish.mockResolvedValue("proof");
    await expect(getRanked(ME, 100)).resolves.toBe(true);
    expect(publish).toHaveBeenCalledWith({ id: "proof" });
    expect(useRankStore.getState().status).toBe("ranked");
    expect(isRankedAirline(ME)).toBe(true);
    // Already ranked: nothing more to do.
    await expect(getRanked(ME)).resolves.toBe(true);
    expect(mine).toHaveBeenCalledTimes(1);
  });

  it("goes back to unranked when cancelled, and to failed on errors", async () => {
    mine.mockImplementation(
      (_template, options: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener("abort", () =>
            reject(new DOMException("Mining cancelled", "AbortError")),
          );
        }),
    );
    const pending = getRanked(ME);
    await vi.waitFor(() => expect(mine).toHaveBeenCalled());
    // A second press while mining doesn't start another miner.
    await expect(getRanked(ME)).resolves.toBe(false);
    cancelRankMining();
    await expect(pending).resolves.toBe(false);
    expect(useRankStore.getState().status).toBe("unranked");

    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mine.mockResolvedValue({ id: "proof" });
    publish.mockRejectedValue(new Error("relays down"));
    await expect(getRanked(ME)).resolves.toBe(false);
    expect(useRankStore.getState().status).toBe("failed");
    error.mockRestore();
    cancelRankMining(); // nothing to cancel: harmless
  });
});

describe("unranked rivals can't dump fares (S72)", () => {
  const suggested = getSuggestedFares(500);
  const dumping: FlightOffer = {
    airlinePubkey: "throwaway",
    fareEconomy: fp(1),
    fareBusiness: fp(1),
    fareFirst: fp(1),
    frequencyPerWeek: 70,
    travelTimeMinutes: 60,
    stops: 0,
    serviceScore: 0.7,
    brandScore: 0.5,
    distanceKm: 500,
  };

  it("floors unranked offers and leaves ranked ones and old offers alone", () => {
    const old = { ...dumping, airlinePubkey: "legacy", distanceKm: undefined };
    const registry = new Map([
      ["A-B", [dumping, { ...dumping, airlinePubkey: "ranked" }]],
      ["C-D", [old]],
    ]);
    const lookup = offersInForce(registry, 10, (pubkey) => pubkey === "ranked");
    const [floored, ranked] = lookup.get("A-B") ?? [];
    expect(floored.fareEconomy).toBe(suggested.economy);
    expect(ranked.fareEconomy).toBe(fp(1));
    expect(lookup.get("C-D")?.[0]).toBe(old);
    expect(offersInForce(registry, 10, () => true).get("A-B")).toBe(registry.get("A-B"));
  });
});
