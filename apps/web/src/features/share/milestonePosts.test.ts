import { describe, expect, it } from "vitest";
import { firstJetAdded } from "./milestonePosts";

const models: Record<string, { type: "turboprop" | "regional" | "narrowbody"; name: string }> = {
  atr: { type: "turboprop", name: "ATR 72-600" },
  e175: { type: "regional", name: "E175" },
  a320: { type: "narrowbody", name: "A320neo" },
};
const modelOf = (id: string) => models[id];
const fleet = (...ids: string[]) => ids.map((modelId) => ({ modelId }));

describe("firstJetAdded()", () => {
  it("spots the first jet joining a turboprop fleet", () => {
    expect(firstJetAdded(fleet("atr"), fleet("atr", "e175"), modelOf)).toBe("E175");
    expect(firstJetAdded(fleet(), fleet("a320"), modelOf)).toBe("A320neo");
  });

  it("stays quiet for turboprops, later jets and unknown models", () => {
    expect(firstJetAdded(fleet("atr"), fleet("atr", "atr"), modelOf)).toBeNull();
    expect(firstJetAdded(fleet("e175"), fleet("e175", "a320"), modelOf)).toBeNull();
    expect(firstJetAdded(fleet(), fleet("mystery"), modelOf)).toBeNull();
  });
});
