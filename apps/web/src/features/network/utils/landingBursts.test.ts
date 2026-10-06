import { fp, type TimelineEvent } from "@acars/core";
import { describe, expect, it } from "vitest";
import { formatBurstAmount, landingBursts } from "./landingBursts";

const AIRPORTS: Record<string, { latitude: number; longitude: number }> = {
  JFK: { latitude: 40.64, longitude: -73.78 },
};
const lookup = (iata: string) => AIRPORTS[iata];

const event = (overrides: Partial<TimelineEvent>): TimelineEvent => ({
  id: "e1",
  tick: 1,
  timestamp: 1,
  type: "landing",
  description: "",
  destinationIata: "JFK",
  profit: fp(12_345),
  ...overrides,
});

describe("formatBurstAmount()", () => {
  it("formats gains and losses compactly with a sign", () => {
    expect(formatBurstAmount(fp(12_345))).toBe("+$12.3K");
    expect(formatBurstAmount(fp(-850))).toBe("−$850");
    expect(formatBurstAmount(fp(2_500_000))).toBe("+$2.5M");
    expect(formatBurstAmount(fp(0))).toBe("+$0");
  });
});

describe("landingBursts()", () => {
  it("labels a landing at its destination with the leg's profit", () => {
    expect(landingBursts([event({})], lookup)).toEqual([
      { id: "e1", longitude: -73.78, latitude: 40.64, text: "+$12.3K", tone: "gain" },
    ]);
  });

  it("marks losing legs and falls back to revenue", () => {
    const [loss] = landingBursts([event({ profit: fp(-500) })], lookup);
    expect(loss.tone).toBe("loss");
    const [revenue] = landingBursts([event({ profit: undefined, revenue: fp(900) })], lookup);
    expect(revenue.text).toBe("+$900");
  });

  it("ignores other events, ferries, unknown airports and missing amounts", () => {
    expect(
      landingBursts(
        [
          event({ type: "takeoff" }),
          event({ type: "ferry" }),
          event({ destinationIata: undefined }),
          event({ destinationIata: "XXX" }),
          event({ profit: undefined, revenue: undefined }),
        ],
        lookup,
      ),
    ).toEqual([]);
  });
});
