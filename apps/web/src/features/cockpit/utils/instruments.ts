import type { AircraftInstance, FixedPoint, TimelineEvent } from "@acars/core";
import { fp, fpAdd, fpSub, fpToNumber, TICKS_PER_HOUR } from "@acars/core";

const DAY = TICKS_PER_HOUR * 24;

export type InstrumentId = "utilization" | "loadFactor" | "margin" | "runway";
/** In the band, a little out, or far out (avionics green / amber / red). */
export type InstrumentState = "normal" | "caution" | "warning" | "none";

export interface Instrument {
  id: InstrumentId;
  /** The value in its natural unit (hours, ratio 0–1, days); null without data. */
  value: number | null;
  /** The same over the previous 24 h, for the trend; null without data. */
  previous: number | null;
  band: { low: number; high: number };
  state: InstrumentState;
  /** Below or above the band (for the fix to offer). */
  side: "low" | "high" | null;
}

export const BANDS: Record<InstrumentId, { low: number; high: number }> = {
  utilization: { low: 8, high: 13 },
  loadFactor: { low: 0.75, high: 0.92 },
  margin: { low: 0.1, high: 0.25 },
  runway: { low: 30, high: Number.POSITIVE_INFINITY },
};

interface Window {
  landings: number;
  blockTicks: number;
  loadFactorSum: number;
  loadFactorCount: number;
  revenue: FixedPoint;
  profit: FixedPoint;
}

const emptyWindow = (): Window => ({
  landings: 0,
  blockTicks: 0,
  loadFactorSum: 0,
  loadFactorCount: 0,
  revenue: fp(0),
  profit: fp(0),
});

function judge(id: InstrumentId, value: number | null): Pick<Instrument, "state" | "side"> {
  if (value === null) return { state: "none", side: null };
  const { low, high } = BANDS[id];
  if (value >= low && value <= high) return { state: "normal", side: null };
  const side = value < low ? "low" : "high";
  // Far out: a third of the band's lower edge away (or under half of it).
  const far = side === "low" ? value < low * 0.6 : value > high * 1.15;
  // Above the band is only a caution (too full, too rich): never a warning.
  return { state: far && side === "low" ? "warning" : "caution", side };
}

/**
 * The cockpit's four instruments over the last 24 h, with the previous 24 h
 * for trends (S62). One pass over the timeline; nothing is estimated that the
 * game does not record. `fixedCostsPerDay` (hub opex and leases) turns the
 * landings' operating profit into the cash the airline actually keeps.
 */
export function computeInstruments({
  timeline,
  fleet,
  tick,
  balance,
  fixedCostsPerDay,
}: {
  timeline: readonly TimelineEvent[];
  fleet: readonly Pick<AircraftInstance, "status">[];
  tick: number;
  balance: FixedPoint;
  fixedCostsPerDay: FixedPoint;
}): Instrument[] {
  const current = emptyWindow();
  const previous = emptyWindow();
  for (const event of timeline) {
    if (event.type !== "landing" || event.tick > tick) continue;
    const window =
      event.tick > tick - DAY ? current : event.tick > tick - 2 * DAY ? previous : null;
    if (!window) continue;
    window.landings += 1;
    window.blockTicks += event.details?.flightDurationTicks ?? 0;
    if (event.details?.loadFactor !== undefined) {
      window.loadFactorSum += event.details.loadFactor;
      window.loadFactorCount += 1;
    }
    if (event.revenue !== undefined) window.revenue = fpAdd(window.revenue, event.revenue);
    if (event.profit !== undefined) window.profit = fpAdd(window.profit, event.profit);
  }

  const planes = fleet.filter((aircraft) => aircraft.status !== "delivery").length;
  const utilization = (w: Window) =>
    planes > 0 && w.landings > 0 ? w.blockTicks / TICKS_PER_HOUR / planes : null;
  const loadFactor = (w: Window) =>
    w.loadFactorCount > 0 ? w.loadFactorSum / w.loadFactorCount : null;
  const margin = (w: Window) =>
    w.revenue > 0 ? fpToNumber(w.profit) / fpToNumber(w.revenue) : null;
  const runway = (w: Window) => {
    if (w.landings === 0) return null;
    const net = fpToNumber(fpSub(w.profit, fixedCostsPerDay));
    if (net >= 0) return Number.POSITIVE_INFINITY;
    return Math.max(0, fpToNumber(balance) / -net);
  };

  const make = (id: InstrumentId, of: (w: Window) => number | null): Instrument => {
    const value = of(current);
    return { id, value, previous: of(previous), band: BANDS[id], ...judge(id, value) };
  };
  return [
    make("utilization", utilization),
    make("loadFactor", loadFactor),
    make("margin", margin),
    make("runway", runway),
  ];
}
