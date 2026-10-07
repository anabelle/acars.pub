import { describe, expect, it } from "vitest";
import { fp } from "./fixed-point.js";
import {
  DAILY_OBJECTIVE_COUNT,
  type DailyObjective,
  EVENT_OBJECTIVE_REWARD,
  emptyObjectiveLedger,
  evaluateDailyObjectives,
  evaluateObjective,
  eventObjectiveForDate,
  getDailyObjectives,
  OBJECTIVE_TEMPLATES,
  type ObjectiveActivity,
  type ObjectiveAirportLookup,
  objectiveDayWindow,
  objectiveRetentionStart,
  pruneObjectiveLedger,
  utcDateForTick,
  verifyObjectiveClaim,
} from "./objectives.js";
import { GENESIS_TIME, TICK_DURATION, TICKS_PER_HOUR } from "./types.js";

const datesFrom = (start: string, days: number) => {
  const base = Date.parse(`${start}T00:00:00Z`);
  return Array.from({ length: days }, (_, i) =>
    new Date(base + i * 86_400_000).toISOString().slice(0, 10),
  );
};

describe("getDailyObjectives()", () => {
  it("is deterministic: the same date always gives the same objectives", () => {
    const a = getDailyObjectives("2026-10-07");
    const b = getDailyObjectives("2026-10-07");
    expect(a).toEqual(b);
    // Pinned so a change to the generator (which would desync clients) is caught.
    expect(a.map((o) => o.id)).toMatchInlineSnapshot(`
      [
        "2026-10-07:openRoute",
        "2026-10-07:openRouteToTag",
        "2026-10-07:adjustSchedule",
        "2026-10-07:routeToEvent",
      ]
    `);
  });

  it("gives three distinct kinds a day, with variants from the template table", () => {
    for (const date of datesFrom("2026-01-01", 400)) {
      // The event objective (S55.2) is checked separately below.
      const objectives = getDailyObjectives(date).filter((o) => o.kind !== "routeToEvent");
      expect(objectives).toHaveLength(DAILY_OBJECTIVE_COUNT);
      expect(new Set(objectives.map((o) => o.kind)).size).toBe(DAILY_OBJECTIVE_COUNT);
      for (const objective of objectives) {
        expect(objective.id).toBe(`${date}:${objective.kind}`);
        expect(objective.date).toBe(date);
        const template = OBJECTIVE_TEMPLATES.find((t) => t.kind === objective.kind);
        expect(template?.variants).toContainEqual({
          target: objective.target,
          reward: objective.reward,
          ...(objective.minDistanceKm !== undefined && { minDistanceKm: objective.minDistanceKm }),
          ...(objective.tag !== undefined && { tag: objective.tag }),
        });
        expect(Number.isSafeInteger(objective.reward)).toBe(true);
        expect(objective.reward).toBeGreaterThan(0);
      }
    }
  });

  it("varies from day to day and uses every kind", () => {
    const days = datesFrom("2026-01-01", 120).map((date) =>
      getDailyObjectives(date)
        .map((o) => o.kind)
        .join(","),
    );
    expect(new Set(days).size).toBeGreaterThan(20);
    const seen = new Set(
      datesFrom("2026-01-01", 120).flatMap((date) => getDailyObjectives(date).map((o) => o.kind)),
    );
    // Every template kind, plus the event objective.
    expect(seen.size).toBe(OBJECTIVE_TEMPLATES.length + 1);
  });

  it("rejects malformed and impossible dates", () => {
    for (const bad of ["2026-2-1", "2026-02-30", "26-01-01", "2026-13-01", ""]) {
      expect(() => getDailyObjectives(bad)).toThrow(/Invalid objective date/);
    }
  });

  it("keeps rewards small next to a starting balance", () => {
    for (const template of OBJECTIVE_TEMPLATES) {
      for (const variant of template.variants) {
        expect(variant.reward).toBeLessThanOrEqual(fp(250_000));
      }
    }
  });
});

describe("objective day window", () => {
  it("covers exactly one UTC day of ticks", () => {
    const { startTick, endTick } = objectiveDayWindow("2026-10-07");
    expect(Number.isInteger(startTick)).toBe(true);
    expect(endTick - startTick).toBe(24 * TICKS_PER_HOUR);
    expect(GENESIS_TIME + startTick * TICK_DURATION).toBe(Date.parse("2026-10-07T00:00:00Z"));
    expect(utcDateForTick(startTick)).toBe("2026-10-07");
    expect(utcDateForTick(endTick - 1)).toBe("2026-10-07");
    expect(utcDateForTick(endTick)).toBe("2026-10-08");
  });

  it("chains days without gaps", () => {
    expect(objectiveDayWindow("2026-10-07").endTick).toBe(
      objectiveDayWindow("2026-10-08").startTick,
    );
    expect(() => objectiveDayWindow("nope")).toThrow();
  });
});

describe("objective progress", () => {
  const DATE = "2026-10-07";
  const { startTick, endTick } = objectiveDayWindow(DATE);
  const airports: Record<string, NonNullable<ReturnType<ObjectiveAirportLookup>>> = {
    MAD: { latitude: 40.47, longitude: -3.56, tags: ["business"] },
    BCN: { latitude: 41.3, longitude: 2.08, tags: ["beach", "business"] },
    JFK: { latitude: 40.64, longitude: -73.78, tags: ["business"] },
    ZRH: { latitude: 47.46, longitude: 8.55, tags: ["ski"] },
  };
  const lookup: ObjectiveAirportLookup = (iata) => airports[iata];
  const objective = (overrides: Partial<DailyObjective>): DailyObjective => ({
    id: `${DATE}:x`,
    date: DATE,
    kind: "openRoute",
    target: 1,
    reward: fp(1),
    ...overrides,
  });
  const route = (
    destinationIata: string,
    tick = startTick + 10,
    routeId = `r-${destinationIata}`,
  ): ObjectiveActivity => ({
    type: "routeOpened",
    tick,
    routeId,
    originIata: "MAD",
    destinationIata,
  });

  it("checks route distance against the catalog, not the payload", () => {
    const longHaul = objective({ minDistanceKm: 3_000 });
    expect(evaluateObjective(longHaul, [route("BCN")], lookup).complete).toBe(false);
    expect(evaluateObjective(longHaul, [route("JFK")], lookup).complete).toBe(true);
    expect(
      evaluateObjective(objective({ minDistanceKm: 0 }), [route("BCN")], lookup).complete,
    ).toBe(true);
    // Unknown airports never qualify.
    expect(evaluateObjective(objective({}), [route("XXX")], lookup).complete).toBe(false);
  });

  it("counts only routes touching the event's airport, either end", () => {
    const festival = objective({ kind: "routeToEvent", airportIata: "BCN", eventKind: "festival" });
    expect(evaluateObjective(festival, [route("JFK")], lookup).complete).toBe(false);
    expect(evaluateObjective(festival, [route("BCN")], lookup).complete).toBe(true);
    const fromBcn: ObjectiveActivity = {
      type: "routeOpened",
      tick: startTick + 10,
      routeId: "r-out",
      originIata: "BCN",
      destinationIata: "JFK",
    };
    expect(evaluateObjective(festival, [fromBcn], lookup).complete).toBe(true);
    // No airport, no progress.
    expect(
      evaluateObjective(objective({ kind: "routeToEvent" }), [route("BCN")], lookup).complete,
    ).toBe(false);
  });

  it("checks the destination's tag", () => {
    const ski = objective({ kind: "openRouteToTag", tag: "ski" });
    expect(evaluateObjective(ski, [route("BCN")], lookup).progress).toBe(0);
    expect(evaluateObjective(ski, [route("ZRH")], lookup).complete).toBe(true);
  });

  it("only counts activity inside the objective's UTC day", () => {
    const any = objective({});
    expect(evaluateObjective(any, [route("BCN", startTick - 1)], lookup).complete).toBe(false);
    expect(evaluateObjective(any, [route("BCN", endTick)], lookup).complete).toBe(false);
    expect(evaluateObjective(any, [route("BCN", startTick)], lookup).complete).toBe(true);
    expect(evaluateObjective(any, [route("BCN", endTick - 1)], lookup).complete).toBe(true);
  });

  it("counts distinct aircraft and caps progress at the target", () => {
    const assign2 = objective({ kind: "assignAircraft", target: 2 });
    const assign = (aircraftId: string): ObjectiveActivity => ({
      type: "aircraftAssigned",
      tick: startTick + 5,
      aircraftId,
      routeId: "r1",
    });
    expect(evaluateObjective(assign2, [assign("a1"), assign("a1")], lookup)).toMatchObject({
      progress: 1,
      complete: false,
    });
    expect(
      evaluateObjective(assign2, [assign("a1"), assign("a2"), assign("a3")], lookup),
    ).toMatchObject({ progress: 2, complete: true });
  });

  it("matches each kind to its own activity type", () => {
    const tick = startTick + 1;
    const activities: ObjectiveActivity[] = [
      { type: "aircraftAcquired", tick, aircraftId: "a1" },
      { type: "faresUpdated", tick, routeId: "r1" },
      { type: "frequencyUpdated", tick, routeId: "r1" },
      { type: "aircraftServiced", tick, aircraftId: "a1" },
    ];
    for (const kind of [
      "acquireAircraft",
      "tuneFares",
      "adjustSchedule",
      "serviceAircraft",
    ] as const) {
      expect(evaluateObjective(objective({ kind }), activities, lookup).complete).toBe(true);
      expect(evaluateObjective(objective({ kind }), [route("BCN")], lookup).complete).toBe(false);
    }
    expect(
      evaluateObjective(objective({ kind: "assignAircraft" }), activities, lookup).complete,
    ).toBe(false);
  });

  it("evaluates the whole day", () => {
    const progress = evaluateDailyObjectives(DATE, [], lookup);
    expect(progress.map((p) => p.objective)).toEqual(getDailyObjectives(DATE));
    expect(progress.every((p) => p.progress === 0 && !p.complete)).toBe(true);
  });
});

describe("objective ledger pruning", () => {
  it("starts empty, with fresh arrays each time", () => {
    const a = emptyObjectiveLedger();
    expect(a).toEqual({ activity: [], claimed: [] });
    expect(emptyObjectiveLedger().activity).not.toBe(a.activity);
  });

  it("keeps today and yesterday, by activity tick and claim date", () => {
    const today = objectiveDayWindow("2026-10-07");
    const yesterday = objectiveDayWindow("2026-10-06");
    expect(objectiveRetentionStart(today.startTick + 500)).toBe(yesterday.startTick);
    const ledger = pruneObjectiveLedger(
      {
        activity: [
          { type: "faresUpdated", tick: yesterday.startTick - 1, routeId: "old" },
          { type: "faresUpdated", tick: yesterday.startTick, routeId: "yday" },
          { type: "faresUpdated", tick: today.startTick + 5, routeId: "today" },
        ],
        claimed: ["2026-10-05:tuneFares", "2026-10-06:tuneFares", "2026-10-07:openRoute"],
      },
      today.startTick + 500,
    );
    expect(ledger.activity.map((a) => a.type === "faresUpdated" && a.routeId)).toEqual([
      "yday",
      "today",
    ]);
    expect(ledger.claimed).toEqual(["2026-10-06:tuneFares", "2026-10-07:openRoute"]);
  });
});

describe("eventObjectiveForDate()", () => {
  it("is deterministic and themed on that day's event", () => {
    expect(eventObjectiveForDate("2026-10-07")).toEqual({
      id: "2026-10-07:routeToEvent",
      date: "2026-10-07",
      kind: "routeToEvent",
      target: 1,
      reward: EVENT_OBJECTIVE_REWARD,
      airportIata: "BCN",
      eventKind: "festival",
    });
    expect(eventObjectiveForDate("2026-10-07")).toEqual(eventObjectiveForDate("2026-10-07"));
  });

  it("is absent on days without an airport event that lifts demand", () => {
    expect(eventObjectiveForDate("2026-01-03")).toBeNull();
    expect(getDailyObjectives("2026-01-03")).toHaveLength(DAILY_OBJECTIVE_COUNT);
  });

  it("is appended after the three template objectives", () => {
    const objectives = getDailyObjectives("2026-10-07");
    expect(objectives).toHaveLength(DAILY_OBJECTIVE_COUNT + 1);
    expect(objectives.at(-1)?.kind).toBe("routeToEvent");
  });
});

describe("verifyObjectiveClaim()", () => {
  // 2026-10-07: open a route ≥1,000 km, open a route to a business airport, adjust a schedule.
  const DATE = "2026-10-07";
  const day = objectiveDayWindow(DATE);
  const lookup: ObjectiveAirportLookup = (iata) =>
    ({
      MAD: { latitude: 40.47, longitude: -3.56, tags: ["business" as const] },
      JFK: { latitude: 40.64, longitude: -73.78, tags: ["business" as const] },
    })[iata];
  const schedule: ObjectiveActivity = {
    type: "frequencyUpdated",
    tick: day.startTick + 10,
    routeId: "r1",
  };
  const verify = (
    objectiveId: string,
    tick: number,
    activity: ObjectiveActivity[] = [schedule],
    claimed: string[] = [],
  ) => verifyObjectiveClaim({ objectiveId, tick, activity, claimed: new Set(claimed), lookup });

  it("accepts a completed objective and returns its reward", () => {
    const verdict = verify(`${DATE}:adjustSchedule`, day.startTick + 20);
    expect(verdict.ok).toBe(true);
    if (verdict.ok) expect(verdict.objective.reward).toBe(fp(25_000));
  });

  it("accepts it the next day, but not before the day or two days later", () => {
    expect(verify(`${DATE}:adjustSchedule`, day.endTick + 100).ok).toBe(true);
    expect(verify(`${DATE}:adjustSchedule`, day.startTick - 1)).toEqual({
      ok: false,
      reason: "expired",
    });
    expect(verify(`${DATE}:adjustSchedule`, day.endTick + (day.endTick - day.startTick))).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("accepts the event objective for a route to the event's airport", () => {
    const toBcn: ObjectiveActivity = {
      type: "routeOpened",
      tick: day.startTick + 10,
      routeId: "r-bcn",
      originIata: "MAD",
      destinationIata: "BCN",
    };
    const verdict = verify(`${DATE}:routeToEvent`, day.startTick + 20, [toBcn]);
    expect(verdict.ok).toBe(true);
    if (verdict.ok) expect(verdict.objective.reward).toBe(EVENT_OBJECTIVE_REWARD);
    expect(verify(`${DATE}:routeToEvent`, day.startTick + 20)).toEqual({
      ok: false,
      reason: "incomplete",
    });
    expect(verify("2026-01-03:routeToEvent", day.startTick + 20).ok).toBe(false);
  });

  it("rejects ids that aren't that day's objectives", () => {
    for (const id of [
      `${DATE}:tuneFares`,
      "2026-02-30:adjustSchedule",
      "nonsense",
      `${DATE}:adjustSchedule:extra`,
    ]) {
      expect(verify(id, day.startTick + 20)).toEqual({ ok: false, reason: "invalid" });
    }
  });

  it("rejects a second claim and an incomplete objective", () => {
    expect(
      verify(`${DATE}:adjustSchedule`, day.startTick + 20, [schedule], [`${DATE}:adjustSchedule`]),
    ).toEqual({
      ok: false,
      reason: "claimed",
    });
    expect(verify(`${DATE}:openRoute`, day.startTick + 20)).toEqual({
      ok: false,
      reason: "incomplete",
    });
  });

  it("only counts activity before the claim's position in the log", () => {
    // The caller passes the ledger as of the claim; later actions aren't in it yet.
    expect(verify(`${DATE}:openRoute`, day.startTick + 20, []).ok).toBe(false);
    const opened: ObjectiveActivity = {
      type: "routeOpened",
      tick: day.startTick + 15,
      routeId: "r2",
      originIata: "MAD",
      destinationIata: "JFK",
    };
    expect(verify(`${DATE}:openRoute`, day.startTick + 20, [opened]).ok).toBe(true);
    expect(verify(`${DATE}:openRouteToTag`, day.startTick + 20, [opened]).ok).toBe(true);
  });
});
