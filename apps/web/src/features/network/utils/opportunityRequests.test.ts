import type { Airport } from "@acars/core";
import { describe, expect, it, vi } from "vitest";

const compute = vi.fn(() => [
  { iata: "BCN", latitude: 0, longitude: 0, profitPerDay: 10, modelName: "x" },
]);
vi.mock("@/features/network/utils/hubOpportunities", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/network/utils/hubOpportunities")>()),
  computeHubOpportunities: () => compute(),
}));

import { createOpportunityHandler } from "./opportunityRequests";

const input = {
  hubIata: "MAD",
  tier: 1,
  tick: 0,
  brandScore: 0.5,
  playerPubkey: "me",
  routes: [],
  registry: new Map(),
};

describe("createOpportunityHandler()", () => {
  it("computes once per hub, hour and network, then serves the cache", async () => {
    const loadAirports = vi.fn(async () => [] as Airport[]);
    let clock = 0;
    const handle = createOpportunityHandler(loadAirports, () => (clock += 7));
    const first = await handle({ id: 1, input });
    expect(first).toMatchObject({ id: 1, hubIata: "MAD", cached: false, ms: 7 });
    expect(first.opportunities).toHaveLength(1);
    const second = await handle({ id: 2, input });
    expect(second).toMatchObject({ id: 2, cached: true, ms: 0 });
    expect(compute).toHaveBeenCalledTimes(1);
    expect(loadAirports).toHaveBeenCalledTimes(1);
    await handle({ id: 3, input: { ...input, hubIata: "BCN" } });
    expect(compute).toHaveBeenCalledTimes(2);
  });
});
