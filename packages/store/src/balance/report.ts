import { dollars, type LegMetrics, runLegScenario } from "./legScenario.js";
import { STRATEGIES, simulateStrategy } from "./strategy.js";

/** Markets from thick to thin. All solo (no rival airlines). */
export const MARKETS: Array<{ label: string; origin: string; destination: string }> = [
  { label: "JFK–BOS (thick, short)", origin: "JFK", destination: "BOS" },
  { label: "MAD–BCN (thick)", origin: "MAD", destination: "BCN" },
  { label: "MAD–LIS (medium)", origin: "MAD", destination: "LIS" },
  { label: "DEN–SLC (medium)", origin: "DEN", destination: "SLC" },
  { label: "LIH–KOA (thin island)", origin: "LIH", destination: "KOA" },
];

export const FARE_MULTIPLIERS = [0.5, 1, 1.5, 2, 3, 5, 10, 20, 40];
export const AIRCRAFT_COUNTS = [1, 3, 10];
export const BASE_MODEL = "atr72-600";

export const FAMILIES: Array<{ modelId: string; origin: string; destination: string }> = [
  { modelId: "atr72-600", origin: "MAD", destination: "BCN" },
  { modelId: "dash8-q400", origin: "MAD", destination: "BCN" },
  { modelId: "a320neo", origin: "MAD", destination: "BCN" },
  { modelId: "a320neo", origin: "JFK", destination: "LAX" },
  { modelId: "b787-9", origin: "JFK", destination: "LHR" },
];

const money = (value: number) =>
  `${value < 0 ? "-" : ""}$${Math.abs(value).toLocaleString("en-US")}`;
const pct = (value: number) => `${Math.round(value * 100)}%`;
const row = (cells: Array<string | number>) => `| ${cells.join(" | ")} |`;
const header = (cells: string[]) =>
  [row(cells), row(cells.map((_, i) => (i === 0 ? "---" : "--:")))].join("\n");

export interface FareSweep {
  market: string;
  results: LegMetrics[];
  best: LegMetrics;
  atSuggested: LegMetrics;
  /** Share of the best profit/leg that comes from pricing above the suggested fare. */
  overpricingShare: number;
}

export function sweepFares(origin: string, destination: string, market: string): FareSweep {
  const results = FARE_MULTIPLIERS.map((fareMultiplier) =>
    runLegScenario({
      originIata: origin,
      destinationIata: destination,
      modelId: BASE_MODEL,
      fareMultiplier,
      aircraftCount: 1,
    }),
  );
  const best = results.reduce((a, b) => (b.profitPerLeg > a.profitPerLeg ? b : a));
  const atSuggested = results.find((r) => r.fareMultiplier === 1) ?? results[0];
  const bestProfit = dollars(best.profitPerLeg);
  const overpricingShare =
    bestProfit > 0 ? Math.max(0, (bestProfit - dollars(atSuggested.profitPerLeg)) / bestProfit) : 0;
  return { market, results, best, atSuggested, overpricingShare };
}

function marketTable(): string {
  const lines = [
    header([
      "Market",
      "km",
      "Model",
      "LF",
      "Pax",
      "Revenue/leg",
      "Profit/leg",
      "Legs/day",
      "Profit/day",
    ]),
  ];
  for (const market of MARKETS) {
    for (const modelId of [BASE_MODEL, "a320neo"]) {
      const m = runLegScenario({
        originIata: market.origin,
        destinationIata: market.destination,
        modelId,
        fareMultiplier: 1,
        aircraftCount: 1,
      });
      lines.push(
        row([
          market.label,
          m.distanceKm,
          modelId,
          pct(m.loadFactor),
          m.passengers,
          money(dollars(m.revenuePerLeg)),
          money(dollars(m.profitPerLeg)),
          m.legsPerDayPerAircraft.toFixed(1),
          money(dollars(m.profitPerDay)),
        ]),
      );
    }
  }
  return lines.join("\n");
}

function fareTable(sweeps: FareSweep[]): string {
  const lines = [
    header(["Market", ...FARE_MULTIPLIERS.map((m) => `${m}×`), "Best", "Overpricing share"]),
  ];
  for (const sweep of sweeps) {
    lines.push(
      row([
        sweep.market,
        ...sweep.results.map((r) => `${money(dollars(r.profitPerLeg))} (${pct(r.loadFactor)})`),
        `${sweep.best.fareMultiplier}×`,
        pct(sweep.overpricingShare),
      ]),
    );
  }
  return lines.join("\n");
}

function oversupplyTable(): string {
  const lines = [
    header(["Market", ...AIRCRAFT_COUNTS.flatMap((n) => [`LF (${n})`, `Route profit/day (${n})`])]),
  ];
  for (const market of MARKETS) {
    const cells: string[] = [];
    for (const aircraftCount of AIRCRAFT_COUNTS) {
      const m = runLegScenario({
        originIata: market.origin,
        destinationIata: market.destination,
        modelId: BASE_MODEL,
        fareMultiplier: 1,
        aircraftCount,
      });
      cells.push(pct(m.loadFactor), money(dollars(m.profitPerDay)));
    }
    lines.push(row([market.label, ...cells]));
  }
  return lines.join("\n");
}

function familyTable(): string {
  const lines = [
    header(["Route", "Model", "km", "LF", "Pax", "Profit/leg", "Legs/day", "Profit/day"]),
  ];
  for (const family of FAMILIES) {
    const m = runLegScenario({
      originIata: family.origin,
      destinationIata: family.destination,
      modelId: family.modelId,
      fareMultiplier: 1,
      aircraftCount: 1,
    });
    lines.push(
      row([
        `${family.origin}–${family.destination}`,
        family.modelId,
        m.distanceKm,
        pct(m.loadFactor),
        m.passengers,
        money(dollars(m.profitPerLeg)),
        m.legsPerDayPerAircraft.toFixed(1),
        money(dollars(m.profitPerDay)),
      ]),
    );
  }
  return lines.join("\n");
}

function strategyTable(days: number): string {
  const lines = [
    header([
      "Strategy",
      "Aircraft / routes",
      "Day-one cost",
      "Profit/day",
      "Cash after 30 days",
      "Days to Tier 2",
      "Days to Tier 3",
      "Days to Tier 4",
    ]),
  ];
  const day = (value: number | null) => (value === null ? `> ${days}` : String(value));
  for (const strategy of STRATEGIES) {
    const result = simulateStrategy(strategy, { days });
    lines.push(
      row([
        `**${strategy.name}**: ${strategy.description}`,
        result.aircraft,
        money(dollars(result.upfrontCost)),
        money(dollars(result.profitPerDay)),
        money(dollars(result.balanceAfter30Days)),
        day(result.daysToTier[2]),
        day(result.daysToTier[3]),
        day(result.daysToTier[4]),
      ]),
    );
  }
  return lines.join("\n");
}

/** Extra sections appended by callers. */
export type ReportSection = { title: string; body: string };

/**
 * The balance report: every number comes from the real flight engine. Solo
 * markets, brand 0.5, tick 1 (fixed fuel and season), suggested fares unless
 * stated. Deterministic, so two runs on the same code are identical.
 */
export function generateBalanceReport(extraSections: ReportSection[] = []): string {
  const sweeps = MARKETS.map((m) => sweepFares(m.origin, m.destination, m.label));
  const sections: ReportSection[] = [
    {
      title: "1. Market size at suggested fares (1 aircraft)",
      body: marketTable(),
    },
    {
      title: `2. Fare sweep (${BASE_MODEL}, 1 aircraft): profit/leg (load factor)`,
      body: `${fareTable(sweeps)}\n\n_Overpricing share: how much of the best profit/leg comes from pricing above the suggested fare._`,
    },
    {
      title: `3. Oversupply (${BASE_MODEL} at suggested fares)`,
      body: oversupplyTable(),
    },
    { title: "4. Aircraft families at suggested fares", body: familyTable() },
    {
      title: "5. Day-one strategies from a MAD hub ($100M start)",
      body: `${strategyTable(365)}\n\n_One leased aircraft per route to the most populous airports in range; each route's economics from a real engine leg at 7 round trips a week (what a new route gets). Tier needs: T2 $5M revenue + 3 routes, T3 $50M + 10, T4 $250M + 25. Ignores the 3-minute delivery, rivals and network effects; strategies keep the ATR 72 after unlocks._`,
    },
    ...extraSections,
  ];
  return [
    "# ACARS economy balance report",
    "",
    "Generated by `pnpm balance` from the real flight engine (`processFlightEngine`). Solo markets, brand 0.5, tick 1 (fixed fuel price and season). Profit/day multiplies one simulated leg by the legs flown per day: the route's weekly frequency (7 unless stated, what a new route gets), capped by block time + turnaround, times the aircraft count.",
    "",
    ...sections.flatMap((section) => [`## ${section.title}`, "", section.body, ""]),
  ].join("\n");
}
