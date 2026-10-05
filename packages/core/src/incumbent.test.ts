import { describe, expect, it } from "vitest";
import {
  entrantMarketShare,
  getIncumbentOffer,
  INCUMBENT_MIN_WEEKLY_FREQUENCY,
  INCUMBENT_TARGET_LOAD_FACTOR,
  incumbentSeatsPerFlight,
} from "./incumbent.js";

describe("incumbent carriers", () => {
  it("flies bigger aircraft on longer routes", () => {
    expect(incumbentSeatsPerFlight(483)).toBeLessThan(incumbentSeatsPerFlight(2000));
    expect(incumbentSeatsPerFlight(2000)).toBeLessThan(incumbentSeatsPerFlight(5000));
    expect(incumbentSeatsPerFlight(5000)).toBeLessThan(incumbentSeatsPerFlight(9000));
  });

  it("sizes its frequency to carry the market at its target load factor", () => {
    const offer = getIncumbentOffer(28_000, 483);
    expect(offer).not.toBeNull();
    expect(offer?.frequencyPerWeek).toBeCloseTo(
      28_000 / (incumbentSeatsPerFlight(483) * INCUMBENT_TARGET_LOAD_FACTOR),
      10,
    );
  });

  it("does not serve markets too thin to sustain it", () => {
    const seats = incumbentSeatsPerFlight(423) * INCUMBENT_TARGET_LOAD_FACTOR;
    expect(getIncumbentOffer(seats * INCUMBENT_MIN_WEEKLY_FREQUENCY - 1, 423)).toBeNull();
    expect(getIncumbentOffer(seats * INCUMBENT_MIN_WEEKLY_FREQUENCY, 423)).not.toBeNull();
    expect(getIncumbentOffer(0, 423)).toBeNull();
  });

  it("leaves a thin market entirely to the players", () => {
    expect(entrantMarketShare(null, [{ frequencyPerWeek: 7, fareRatio: 1 }])).toBe(1);
  });

  it("gives an entrant its frequency share at the suggested fare", () => {
    const incumbent = { frequencyPerWeek: 290, seatsPerFlight: 120 };
    expect(entrantMarketShare(incumbent, [{ frequencyPerWeek: 7, fareRatio: 1 }])).toBeCloseTo(
      7 / 297,
      12,
    );
  });

  it("wins share with frequency and loses it with price", () => {
    const incumbent = { frequencyPerWeek: 100, seatsPerFlight: 120 };
    const base = entrantMarketShare(incumbent, [{ frequencyPerWeek: 7, fareRatio: 1 }]);
    expect(entrantMarketShare(incumbent, [{ frequencyPerWeek: 14, fareRatio: 1 }])).toBeGreaterThan(
      base,
    );
    expect(entrantMarketShare(incumbent, [{ frequencyPerWeek: 7, fareRatio: 2 }])).toBeLessThan(
      base,
    );
    expect(
      entrantMarketShare(incumbent, [{ frequencyPerWeek: 7, fareRatio: 0.5 }]),
    ).toBeGreaterThan(base);
    // Several entrants add up.
    expect(
      entrantMarketShare(incumbent, [
        { frequencyPerWeek: 7, fareRatio: 1 },
        { frequencyPerWeek: 7, fareRatio: 1 },
      ]),
    ).toBeCloseTo(14 / 114, 12);
  });

  it("gives nothing to entrants that don't fly", () => {
    const incumbent = { frequencyPerWeek: 100, seatsPerFlight: 120 };
    expect(entrantMarketShare(incumbent, [])).toBe(0);
    expect(entrantMarketShare(incumbent, [{ frequencyPerWeek: 0, fareRatio: 1 }])).toBe(0);
    expect(entrantMarketShare(null, [])).toBe(0);
    // A zero fare is treated as extremely cheap, not as a division by zero.
    expect(entrantMarketShare(incumbent, [{ frequencyPerWeek: 7, fareRatio: 0 }])).toBeGreaterThan(
      0.99,
    );
  });
});
