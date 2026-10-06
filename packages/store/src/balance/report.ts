import { MAX_ROUTE_FREQUENCY_PER_WEEK, TIER_THRESHOLDS } from "@acars/core";
import {
  BRAND_MARKET,
  BRAND_STRATEGIES,
  brandTrajectory,
  MAX_CURVE_AIRCRAFT,
  overAssignmentCurve,
} from "./brand.js";
import { dollars, type LegMetrics, runLegScenario } from "./legScenario.js";
import { hubDestinations, STRATEGIES, simulateStrategy } from "./strategy.js";

/** Markets from thick to thin. All solo (no rival airlines). */
export const MARKETS: Array<{ label: string; origin: string; destination: string }> = [
  { label: "JFK–BOS (thick, short)", origin: "JFK", destination: "BOS" },
  { label: "MAD–BCN (thick)", origin: "MAD", destination: "BCN" },
  { label: "MAD–LIS (medium)", origin: "MAD", destination: "LIS" },
  { label: "DEN–SLC (medium)", origin: "DEN", destination: "SLC" },
  { label: "LIH–KOA (thin island)", origin: "LIH", destination: "KOA" },
];

/** Up to the cap (3×, S10): above it the engine flies at the cap anyway. */
export const FARE_MULTIPLIERS = [0.5, 0.8, 1, 1.2, 1.4, 1.6, 2, 2.5, 3];
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
        // Each aircraft flies as much as it can: that is what oversupply means.
        frequencyPerWeek: MAX_ROUTE_FREQUENCY_PER_WEEK,
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

function overAssignmentSection(): string {
  const curve = overAssignmentCurve();
  const lines = [header(["Aircraft", "LF", "", "Route profit/day", "Brand grade"])];
  for (const m of curve) {
    lines.push(
      row([
        m.aircraftCount,
        pct(m.loadFactor),
        `\`${"█".repeat(Math.round(m.loadFactor * 40)).padEnd(40, "·")}\``,
        money(dollars(m.profitPerDay)),
        m.brandGrade.toFixed(2),
      ]),
    );
  }
  return lines.join("\n");
}

function brandSection(days: number): string {
  const checkpoints = [0, 7, 14, 21, days];
  const lines = [
    header([
      "Strategy",
      "LF",
      "Brand grade",
      "Landings/day",
      "Route profit/day",
      ...checkpoints.map((day) => `Brand day ${day}`),
    ]),
  ];
  for (const strategy of BRAND_STRATEGIES) {
    const t = brandTrajectory(strategy, days);
    lines.push(
      row([
        `**${strategy.name}**: ${strategy.description}`,
        pct(t.leg.loadFactor),
        t.leg.brandGrade.toFixed(2),
        t.landingsPerDay.toFixed(1),
        money(dollars(t.leg.profitPerDay)),
        ...checkpoints.map((day) => t.brandByDay[day].toFixed(2)),
      ]),
    );
  }
  return lines.join("\n");
}

function tierNeeds(): string {
  return [2, 3, 4]
    .map((tier) => {
      const { minCumulativeRevenue, minActiveRoutes } = TIER_THRESHOLDS[tier];
      return `T${tier} ${money(dollars(minCumulativeRevenue))} revenue + ${minActiveRoutes} routes`;
    })
    .join(", ");
}

/** README §6 balance targets, checked from the same engine runs. */
function targetsSection(sweeps: FareSweep[]): string {
  const outOfBand = sweeps.filter(
    (sweep) => sweep.best.fareMultiplier < 0.8 || sweep.best.fareMultiplier > 1.6,
  );
  const fareLine = `- **No solved optimum** (best fare 0.8–1.6× on every market): ${
    outOfBand.length === 0
      ? "✅ met"
      : `❌ ${outOfBand.map((s) => `${s.market} ${s.best.fareMultiplier}×`).join(", ")}`
  }`;

  // Spread of profit/day across 20 routes a MAD-based player could open,
  // sampled across market sizes (every 3rd of the 60 biggest in ATR range),
  // each flown with the better of an ATR 72 and an A320neo at 1×.
  const sample = hubDestinations("MAD", 1500, 60).filter((_, index) => index % 3 === 0);
  const profits = sample.map((destinationIata) =>
    Math.max(
      ...[BASE_MODEL, "a320neo"].map((modelId) =>
        dollars(
          runLegScenario({
            originIata: "MAD",
            destinationIata,
            modelId,
            fareMultiplier: 1,
            aircraftCount: 1,
          }).profitPerDay,
        ),
      ),
    ),
  );
  const mean = profits.reduce((sum, value) => sum + value, 0) / profits.length;
  const variance = profits.reduce((sum, value) => sum + (value - mean) ** 2, 0) / profits.length;
  const cv = mean !== 0 ? Math.sqrt(variance) / Math.abs(mean) : Number.POSITIVE_INFINITY;
  const spreadLine = `- **Decisions matter** (coefficient of variation of profit/day > 0.3 across 20 MAD routes of every size, each with the better of ATR 72 and A320neo at 1×): ${
    cv > 0.3 ? "✅" : "❌"
  } CV ${cv.toFixed(2)} (min ${money(Math.min(...profits))}, max ${money(Math.max(...profits))}/day)`;
  return [fareLine, spreadLine].join("\n");
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
    { title: "0. Balance targets (README §6)", body: targetsSection(sweeps) },
    {
      title: "1. Market size at suggested fares (1 aircraft)",
      body: marketTable(),
    },
    {
      title: `2. Fare sweep (${BASE_MODEL}, 1 aircraft): profit/leg (load factor)`,
      body: `${fareTable(sweeps)}\n\n_Overpricing share: how much of the best profit/leg comes from pricing above the suggested fare._`,
    },
    {
      title: `3. Oversupply (${BASE_MODEL} at suggested fares, every aircraft flying as much as it can)`,
      body: oversupplyTable(),
    },
    { title: "4. Aircraft families at suggested fares", body: familyTable() },
    {
      title: "5. Day-one strategies from a MAD hub ($100M start)",
      body: `${strategyTable(365)}\n\n_One leased aircraft per route to the most populous airports in range; each route's economics from a real engine leg at 7 round trips a week (what a new route gets). Tier needs: ${tierNeeds()}. Ignores the 3-minute delivery, rivals and network effects; strategies keep the ATR 72 after unlocks._`,
    },
    {
      title: `6. Over-assignment curve (${BRAND_MARKET.modelId} on ${BRAND_MARKET.origin}–${BRAND_MARKET.destination}, 1–${MAX_CURVE_AIRCRAFT} aircraft, suggested fares, every aircraft flying as much as it can)`,
      body: `${overAssignmentSection()}\n\n_Oversupply is applied once (S11): LF = min(88%, demand ÷ seats). Past 16 aircraft the route's frequency cap binds, so extra aircraft sit idle._`,
    },
    {
      title: `7. Brand trajectories over 30 days (${BRAND_MARKET.origin}–${BRAND_MARKET.destination}, new airline at 0.5)`,
      body: `${brandSection(30)}\n\n_Brand v2 (S11): each landing is graded on fare vs the market reference (fair up to 1.2×), aircraft condition (≥ 0.6) and load factor (+1 only in 60–90%, penalised below 50%). The brand closes 1/400 of the gap to the grade's target (0.1–0.9) per landing._`,
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
