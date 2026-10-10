import {
  fpToNumber,
  MAX_ROUTE_FREQUENCY_PER_WEEK,
  setActiveEventsOverride,
  TIER_THRESHOLDS,
  WORLD_EVENT_TEMPLATES,
  type WorldEvent,
} from "@acars/core";
import { getAircraftById } from "@acars/data";
import { bestWeeklyFrequency } from "../routeProjection.js";
import {
  BRAND_MARKET,
  BRAND_STRATEGIES,
  brandTrajectory,
  MAX_CURVE_AIRCRAFT,
  overAssignmentCurve,
} from "./brand.js";
import { dollars, type LegMetrics, routeDistanceKm, runLegScenario } from "./legScenario.js";
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

/** Routes measured at real utilization (S58): market sizes and aircraft families. */
export const UTILIZATION_CASES: Array<{ modelId: string; origin: string; destination: string }> = [
  ...MARKETS.flatMap((m) => [
    { modelId: "atr72-600", origin: m.origin, destination: m.destination },
    { modelId: "a320neo", origin: m.origin, destination: m.destination },
  ]),
  { modelId: "dash8-q400", origin: "MAD", destination: "BCN" },
  { modelId: "a320neo", origin: "JFK", destination: "LAX" },
  { modelId: "b787-9", origin: "JFK", destination: "LHR" },
];

function utilizationTable(): string {
  const lines = [
    header([
      "Route",
      "Model",
      "km",
      "Round trips/wk",
      "Block h/day",
      "LF",
      "Revenue/day",
      "Profit/day after lease",
      "Margin",
    ]),
  ];
  for (const c of UTILIZATION_CASES) {
    const model = getAircraftById(c.modelId);
    if (!model) continue;
    const distanceKm = routeDistanceKm(c.origin, c.destination);
    const best = bestWeeklyFrequency({
      originIata: c.origin,
      destinationIata: c.destination,
      distanceKm,
      model,
      tick: 1,
    });
    const revenue = fpToNumber(best.projection.revenuePerDay);
    const profit = fpToNumber(best.projection.profitPerDay) - fpToNumber(model.monthlyLease) / 30;
    const blockHours = ((best.frequencyPerWeek * 2) / 7) * (distanceKm / model.speedKmh);
    lines.push(
      row([
        `${c.origin}–${c.destination}`,
        c.modelId,
        distanceKm,
        best.frequencyPerWeek,
        blockHours.toFixed(1),
        pct(best.projection.loadFactor),
        money(Math.round(revenue)),
        money(Math.round(profit)),
        revenue > 0 ? pct(profit / revenue) : "—",
      ]),
    );
  }
  return lines.join("\n");
}

function strategyTable(days: number, utilization: "default" | "best" = "default"): string {
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
    const result = simulateStrategy(strategy, { days, utilization });
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

/** The market world events are measured on: medium demand, below the LF ceiling. */
export const EVENT_MARKET = { origin: "DEN", destination: "SLC" } as const;

/**
 * World events (S33) on one market, each against the same calm leg: the
 * event is pinned at the destination (or globally for fuel), so the only
 * difference is the event itself. Includes the worst stacks the clamps allow.
 */
function worldEventsSection(): string {
  const leg = () =>
    runLegScenario({
      originIata: EVENT_MARKET.origin,
      destinationIata: EVENT_MARKET.destination,
      modelId: BASE_MODEL,
      fareMultiplier: 1,
      aircraftCount: 1,
    });
  const pinned = (events: WorldEvent[]) => {
    setActiveEventsOverride(events);
    try {
      return leg();
    } finally {
      setActiveEventsOverride([]);
    }
  };
  const event = (
    template: (typeof WORLD_EVENT_TEMPLATES)[number],
    airportIata: string | null,
  ): WorldEvent => ({
    id: `${template.kind}@${airportIata ?? "global"}`,
    kind: template.kind,
    airportIata,
    startTick: 0,
    endTick: Number.MAX_SAFE_INTEGER,
    demandMultiplier: template.demandMultiplier,
    feesMultiplier: template.feesMultiplier,
    fuelMultiplier: template.fuelMultiplier,
  });
  const template = (kind: WorldEvent["kind"]) =>
    WORLD_EVENT_TEMPLATES.find((t) => t.kind === kind)!;

  const calm = pinned([]);
  const scenarios: Array<{ label: string; events: WorldEvent[] }> = [
    ...WORLD_EVENT_TEMPLATES.map((t) => ({
      label: t.kind,
      events: [event(t, t.airports.length > 0 ? EVENT_MARKET.destination : null)],
    })),
    {
      label: "strike at both ends",
      events: [
        event(template("strike"), EVENT_MARKET.origin),
        event(template("strike"), EVENT_MARKET.destination),
      ],
    },
    {
      label: "festival + strike at DEN, final + congestion at SLC",
      events: [
        event(template("festival"), EVENT_MARKET.origin),
        event(template("sportsFinal"), EVENT_MARKET.destination),
        event(template("hubCongestion"), EVENT_MARKET.destination),
        event(template("strike"), EVENT_MARKET.origin),
      ],
    },
  ];
  const calmProfit = dollars(calm.profitPerLeg);
  const rows = scenarios.map(({ label, events }) => {
    const m = pinned(events);
    const profit = dollars(m.profitPerLeg);
    const change = calmProfit !== 0 ? (profit - calmProfit) / Math.abs(calmProfit) : 0;
    return row([
      label,
      pct(m.loadFactor),
      money(profit),
      `${change >= 0 ? "+" : ""}${Math.round(change * 100)}%`,
    ]);
  });
  return [
    header(["Event", "LF", "Profit/leg", "vs calm"]),
    row(["calm (no events)", pct(calm.loadFactor), money(calmProfit), "—"]),
    ...rows,
  ].join("\n");
}

/** Extra sections appended by callers. */
export type ReportSection = { title: string; body: string };

/**
 * The balance report: every number comes from the real flight engine. Solo
 * markets, brand 0.5, tick 1 (fixed fuel and season), suggested fares unless
 * stated. Deterministic, so two runs on the same code are identical.
 */
export function generateBalanceReport(extraSections: ReportSection[] = []): string {
  // A calm world: the real schedule could put an event on a market at tick 1
  // and shift every table. Section 8 pins events explicitly.
  setActiveEventsOverride([]);
  try {
    return buildReport(extraSections);
  } finally {
    setActiveEventsOverride(null);
  }
}

function buildReport(extraSections: ReportSection[]): string {
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
    {
      title: `8. World events (${BASE_MODEL} on ${EVENT_MARKET.origin}–${EVENT_MARKET.destination}, 1 aircraft, suggested fares)`,
      body: `${worldEventsSection()}\n\n_Each event pinned at ${EVENT_MARKET.destination} (fuel spike: global) against the same calm leg. Combined effects are clamped (S33): demand ×0.6–1.6, fees ≤ ×1.5, fuel ≤ ×1.2._`,
    },
    {
      title: "9. Real utilization (S58): one aircraft at the suggested frequency",
      body: `${utilizationTable()}\n\n_The frequency that earns the most operating profit per day within an 18-hour operating day (\`bestWeeklyFrequency\`). Margin = profit after the aircraft's lease ÷ revenue. Target (D19): 10–20% on good markets, losses on thin ones._`,
    },
    {
      title: "10. Day-one strategies at real utilization (S58)",
      body: `${strategyTable(365, "best")}\n\n_As section 5, with each route flown at its suggested frequency._`,
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
