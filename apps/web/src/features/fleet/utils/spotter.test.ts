import { aircraftModels } from "@acars/data";
import { describe, expect, it } from "vitest";
import { spotterEntries } from "./spotter";

describe("spotterEntries (S61)", () => {
  it("lists every catalog type: owned first, then next, then locked", () => {
    const fleet = [{ modelId: "atr72-600" }, { modelId: "atr72-600" }];
    const { entries, owned, total } = spotterEntries(aircraftModels, fleet, 1);
    expect(total).toBe(aircraftModels.length);
    expect(owned).toBe(1);
    expect(entries[0]).toMatchObject({ state: "owned", count: 2 });
    expect(entries[0].model.id).toBe("atr72-600");
    const states = entries.map((entry) => entry.state);
    expect(states.indexOf("locked")).toBeGreaterThan(states.lastIndexOf("next"));
    for (const entry of entries) {
      if (entry.state === "next") expect(entry.model.unlockTier).toBeLessThanOrEqual(1);
      if (entry.state === "locked") expect(entry.model.unlockTier).toBeGreaterThan(1);
    }
  });

  it("unlocks more types at higher tiers", () => {
    const low = spotterEntries(aircraftModels, [], 1).entries.filter(
      (e) => e.state === "next",
    ).length;
    const high = spotterEntries(aircraftModels, [], 4).entries.filter(
      (e) => e.state === "next",
    ).length;
    expect(high).toBeGreaterThan(low);
  });
});
