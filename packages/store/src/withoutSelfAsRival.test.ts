import type { AirlineEntity, FlightOffer } from "@acars/core";
import { describe, expect, it } from "vitest";
import { withoutSelfAsRival } from "./airline.js";
import type { AirlineState } from "./types.js";

const airline = (pubkey: string) => ({ ceoPubkey: pubkey }) as AirlineEntity;
const offer = (airlinePubkey: string) => ({ airlinePubkey }) as FlightOffer;
const state = (extra: Partial<AirlineState>) =>
  ({
    pubkey: null,
    competitors: new Map(),
    globalRouteRegistry: new Map(),
    ...extra,
  }) as AirlineState;

describe("withoutSelfAsRival", () => {
  it("drops the player from rivals and their offers when a sync brings them in", () => {
    const next = withoutSelfAsRival(state({ pubkey: "me" }), {
      competitors: new Map([
        ["me", airline("me")],
        ["rival", airline("rival")],
      ]),
      globalRouteRegistry: new Map([["BCN-MAD", [offer("me"), offer("rival")]]]),
    });
    expect([...(next.competitors?.keys() ?? [])]).toEqual(["rival"]);
    expect(next.globalRouteRegistry?.get("BCN-MAD")).toEqual([offer("rival")]);
  });

  it("drops them when the identity lands after the sync", () => {
    const before = state({
      competitors: new Map([["me", airline("me")]]),
      globalRouteRegistry: new Map([["BCN-MAD", [offer("me")]]]),
    });
    const next = withoutSelfAsRival(before, { pubkey: "me" });
    expect(next.competitors?.size).toBe(0);
    expect(next.globalRouteRegistry?.get("BCN-MAD")).toEqual([]);
  });

  it("passes anything else through untouched", () => {
    const partial = { competitors: new Map([["rival", airline("rival")]]) };
    expect(withoutSelfAsRival(state({ pubkey: "me" }), partial)).toBe(partial);
    const noIdentity = { competitors: new Map([["me", airline("me")]]) };
    expect(withoutSelfAsRival(state({}), noIdentity)).toBe(noIdentity);
  });
});
