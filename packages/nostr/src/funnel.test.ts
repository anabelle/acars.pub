import { describe, expect, it } from "vitest";
import {
  buildJourneys,
  CHECKPOINT_TYPE,
  FIRST_LANDING_FALLBACK_SEC,
  type FunnelEvent,
  FUNNEL_WORLD_ID,
  formatFunnelReport,
  percentile,
  summarizeFunnel,
  timeToFirstAssignment,
  utcWeekStart,
  weeklyCohorts,
  collectFunnelEvents,
  countByDayAndType,
  formatDailyCounts,
  parseFunnelEvent,
  type RawNostrEvent,
  utcDay,
} from "./funnel.js";
import { WORLD_ID } from "./schema.js";

const WORLD = "w1";
const DAY = 86_400;
const T0 = Date.UTC(2026, 9, 1) / 1000; // 2026-10-01T00:00Z

let nextId = 0;
function action(
  pubkey: string,
  createdAt: number,
  type: string,
  world = WORLD,
  payload: Record<string, unknown> = {},
): RawNostrEvent {
  nextId += 1;
  return {
    id: `e${nextId}`,
    pubkey,
    created_at: createdAt,
    kind: 30078,
    tags: [["d", `airtr:world:${world}:action:${type.toLowerCase()}`]],
    content: JSON.stringify({ schemaVersion: 2, action: type, payload }),
  };
}

describe("parseFunnelEvent()", () => {
  it("reads action events of the world", () => {
    expect(parseFunnelEvent(action("a", T0, "ROUTE_OPEN"), WORLD)).toEqual({
      pubkey: "a",
      createdAt: T0,
      type: "ROUTE_OPEN",
    });
  });

  it("reads checkpoints and snapshots as saved state", () => {
    for (const suffix of ["checkpoint", "snapshot"]) {
      const event = { ...action("a", T0, "X"), tags: [["d", `airtr:world:${WORLD}:${suffix}`]] };
      expect(parseFunnelEvent(event, WORLD)?.type).toBe(CHECKPOINT_TYPE);
    }
  });

  it("ignores other worlds, kinds, d-tags and bad content", () => {
    expect(parseFunnelEvent(action("a", T0, "ROUTE_OPEN", "other"), WORLD)).toBeNull();
    expect(parseFunnelEvent({ ...action("a", T0, "X"), kind: 1 }, WORLD)).toBeNull();
    expect(parseFunnelEvent({ ...action("a", T0, "X"), tags: [] }, WORLD)).toBeNull();
    expect(parseFunnelEvent({ ...action("a", T0, "X"), content: "{" }, WORLD)).toBeNull();
    expect(parseFunnelEvent({ ...action("a", T0, "X"), content: "null" }, WORLD)).toBeNull();
    expect(
      parseFunnelEvent({ ...action("a", T0, "X"), content: '{"action":""}' }, WORLD),
    ).toBeNull();
  });
});

describe("collectFunnelEvents()", () => {
  it("de-duplicates across relays and sorts by time", () => {
    const late = action("a", T0 + 10, "ROUTE_OPEN");
    const early = action("b", T0, "AIRLINE_CREATE");
    const result = collectFunnelEvents([late, early, late, action("c", T0, "X", "other")], WORLD);
    expect(result.map((e) => e.type)).toEqual(["AIRLINE_CREATE", "ROUTE_OPEN"]);
  });
});

describe("countByDayAndType()", () => {
  const events = collectFunnelEvents(
    [
      action("a", T0 + 100, "AIRLINE_CREATE"),
      action("a", T0 + 200, "ROUTE_OPEN"),
      action("b", T0 + 300, "ROUTE_OPEN"),
      action("a", T0 + DAY + 5, "TICK_UPDATE"),
      action("a", T0 - 5, "ROUTE_OPEN"), // before range
      action("a", T0 + 3 * DAY, "ROUTE_OPEN"), // at the exclusive end
    ],
    WORLD,
  );
  const result = countByDayAndType(events, T0, T0 + 3 * DAY);

  it("lists every day in the range, even empty ones", () => {
    expect(result.days).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(result.counts["2026-10-03"]).toEqual({});
  });

  it("counts by type and active airlines per day", () => {
    expect(result.counts["2026-10-01"]).toEqual({ AIRLINE_CREATE: 1, ROUTE_OPEN: 2 });
    expect(result.counts["2026-10-02"]).toEqual({ TICK_UPDATE: 1 });
    expect(result.activeAirlines).toEqual({ "2026-10-01": 2, "2026-10-02": 1, "2026-10-03": 0 });
    expect(result.types).toEqual(["AIRLINE_CREATE", "ROUTE_OPEN", "TICK_UPDATE"]);
  });

  it("formats an aligned table", () => {
    const table = formatDailyCounts(result).split("\n");
    expect(table[0]).toMatch(/day\s+active\s+AIRLINE_CREATE\s+ROUTE_OPEN\s+TICK_UPDATE/);
    expect(table[1]).toMatch(/2026-10-01\s+2\s+1\s+2\s+0/);
    expect(table).toHaveLength(4);
  });

  it("formats UTC days", () => {
    expect(utcDay(T0 + DAY - 1)).toBe("2026-10-01");
  });
});

describe("FUNNEL_WORLD_ID", () => {
  it("tracks the game's world id", () => {
    expect(FUNNEL_WORLD_ID).toBe(WORLD_ID);
  });
});

describe("payload fields", () => {
  it("keeps route id and distance, ignoring bad values", () => {
    const open = action("a", T0, "ROUTE_OPEN", WORLD, { routeId: "r1", distanceKm: 483 });
    expect(parseFunnelEvent(open, WORLD)).toMatchObject({ routeId: "r1", distanceKm: 483 });
    const bad = action("a", T0, "ROUTE_OPEN", WORLD, { routeId: "", distanceKm: -1 });
    const parsed = parseFunnelEvent(bad, WORLD);
    expect(parsed?.routeId).toBeUndefined();
    expect(parsed?.distanceKm).toBeUndefined();
    const noPayload = { ...open, content: JSON.stringify({ action: "ROUTE_OPEN" }) };
    expect(parseFunnelEvent(noPayload, WORLD)).toEqual({
      pubkey: "a",
      createdAt: T0,
      type: "ROUTE_OPEN",
    });
  });
});

const ev = (
  pubkey: string,
  at: number,
  type: string,
  extra: Partial<FunnelEvent> = {},
): FunnelEvent => ({
  pubkey,
  createdAt: at,
  type,
  ...extra,
});

describe("buildJourneys()", () => {
  const events: FunnelEvent[] = [
    // a: full journey, back on day 8
    ev("a", T0, "AIRLINE_CREATE"),
    ev("a", T0 + 600, "ROUTE_OPEN", { routeId: "r1", distanceKm: 500 }),
    ev("a", T0 + 900, "ROUTE_ASSIGN_AIRCRAFT", { routeId: "r1" }),
    ev("a", T0 + 8 * DAY, CHECKPOINT_TYPE),
    // b: opened a route, assigned to an unknown route, gone after an hour
    ev("b", T0 + 100, "AIRLINE_CREATE"),
    ev("b", T0 + 200, "ROUTE_OPEN"),
    ev("b", T0 + 300, "ROUTE_ASSIGN_AIRCRAFT", { routeId: "zz" }),
    // c: created and left
    ev("c", T0 + 2 * DAY, "AIRLINE_CREATE"),
    // d: activity but genesis outside the window → no journey
    ev("d", T0, "ROUTE_OPEN"),
  ];
  const journeys = buildJourneys(events);

  it("builds one journey per created airline", () => {
    expect(journeys).toHaveLength(3);
  });

  it("estimates first landing from the route distance, or a fallback", () => {
    expect(journeys[0]).toEqual({
      createdAt: T0,
      firstRouteAt: T0 + 600,
      firstAssignAt: T0 + 900,
      firstLandingAt: T0 + 900 + 3600,
      lastSeenAt: T0 + 8 * DAY,
      referrer: null,
    });
    expect(journeys[1].firstLandingAt).toBe(T0 + 300 + FIRST_LANDING_FALLBACK_SEC);
    expect(journeys[2]).toMatchObject({
      firstRouteAt: null,
      firstAssignAt: null,
      firstLandingAt: null,
    });
  });

  it("summarizes the funnel with only measurable retention", () => {
    const summary = summarizeFunnel(journeys, T0 + 10 * DAY);
    expect(summary).toMatchObject({ created: 3, openedRoute: 2, assigned: 2, landed: 2 });
    expect(summary.retention[1]).toEqual({ eligible: 3, retained: 1 });
    expect(summary.retention[7]).toEqual({ eligible: 3, retained: 1 });
    expect(summary.retention[30]).toEqual({ eligible: 0, retained: 0 });
    // A landing still in the air does not count.
    expect(summarizeFunnel(journeys, T0 + 1000).landed).toBe(0);
  });

  it("measures time to first assignment", () => {
    expect(timeToFirstAssignment(journeys)).toEqual({ count: 2, median: 200, p75: 900 });
    expect(timeToFirstAssignment([])).toEqual({ count: 0, median: null, p75: null });
  });

  it("groups cohorts by creation week", () => {
    const later = buildJourneys([...events, ev("e", T0 + 7 * DAY, "AIRLINE_CREATE")]);
    const cohorts = weeklyCohorts(later, T0 + 10 * DAY);
    expect(cohorts.map((c) => [c.week, c.created])).toEqual([
      ["2026-09-28", 3],
      ["2026-10-05", 1],
    ]);
  });
});

describe("percentile() and utcWeekStart()", () => {
  it("uses nearest rank", () => {
    expect(percentile([5, 1, 3, 2, 4], 50)).toBe(3);
    expect(percentile([5, 1, 3, 2, 4], 75)).toBe(4);
    expect(percentile([7], 0)).toBe(7);
    expect(percentile([], 50)).toBeNull();
  });

  it("finds the Monday of the week", () => {
    expect(utcWeekStart(T0)).toBe("2026-09-28"); // Thu 2026-10-01
    expect(utcWeekStart(Date.UTC(2026, 9, 5) / 1000)).toBe("2026-10-05"); // a Monday
    expect(utcWeekStart(Date.UTC(2026, 9, 11, 23) / 1000)).toBe("2026-10-05"); // Sunday
  });
});

describe("formatFunnelReport()", () => {
  const events = [
    ev("pk-a", T0, "AIRLINE_CREATE"),
    ev("pk-a", T0 + 600, "ROUTE_OPEN", { routeId: "r1", distanceKm: 500 }),
    ev("pk-a", T0 + 900, "ROUTE_ASSIGN_AIRCRAFT", { routeId: "r1" }),
    ev("pk-b", T0 + 100, "AIRLINE_CREATE"),
  ];
  const report = formatFunnelReport({
    worldId: WORLD,
    sinceSec: T0,
    untilSec: T0 + 2 * DAY,
    relays: [
      { url: "wss://a", events: 4 },
      { url: "wss://down", events: null },
    ],
    events,
  });

  it("has every section", () => {
    for (const heading of [
      "# ACARS funnel — 2026-10-03",
      "## Funnel",
      "## Weekly cohorts",
      "## Daily events",
    ]) {
      expect(report).toContain(heading);
    }
  });

  it("reports the funnel, retention and unreachable relays", () => {
    expect(report).toContain("| Created | 2 | 100% |");
    expect(report).toContain("| Assigned an aircraft | 1 | 50% |");
    expect(report).toContain("| D1 | 2 | 0 | 0% |");
    expect(report).toContain("| D7 | 0 | 0 | — |");
    expect(report).toContain("Relays read: 1 of 2 (unreachable: wss://down)");
    expect(report).toContain("median 15 min");
  });

  it("never prints pubkeys", () => {
    expect(report).not.toContain("pk-a");
    expect(report).not.toContain("pk-b");
  });

  it("omits the unreachable list when every relay answered", () => {
    const ok = formatFunnelReport({
      worldId: WORLD,
      sinceSec: T0,
      untilSec: T0 + DAY,
      relays: [{ url: "wss://a", events: 0 }],
      events: [],
    });
    expect(ok).toContain("Relays read: 1 of 1. Game events: 0.");
    expect(ok).toContain("median —");
  });
});

describe("referrals (S51)", () => {
  const A = "a".repeat(64);
  const B = "b".repeat(64);
  const C = "c".repeat(64);

  it("reads a valid referrer from AIRLINE_CREATE only, never self", () => {
    const create = (pubkey: string, referrer: unknown) =>
      parseFunnelEvent(action(pubkey, T0, "AIRLINE_CREATE", WORLD, { referrer }), WORLD);
    expect(create(B, A)?.referrer).toBe(A);
    expect(create(A, A)?.referrer).toBeUndefined();
    expect(create(B, "npub1nothex")?.referrer).toBeUndefined();
    expect(
      parseFunnelEvent(action(B, T0, "ROUTE_OPEN", WORLD, { referrer: A }), WORLD)?.referrer,
    ).toBeUndefined();
  });

  it("reports referred signups as counts, without pubkeys", () => {
    const events = collectFunnelEvents(
      [
        action(A, T0, "AIRLINE_CREATE"),
        action(B, T0 + 60, "AIRLINE_CREATE", WORLD, { referrer: A }),
        action(B, T0 + 120, "ROUTE_OPEN", WORLD, { routeId: "r1", distanceKm: 500 }),
        action(C, T0 + 180, "AIRLINE_CREATE", WORLD, { referrer: A }),
      ],
      WORLD,
    );
    expect(buildJourneys(events).map((j) => j.referrer)).toEqual([null, A, A]);
    const report = formatFunnelReport({
      worldId: WORLD,
      sinceSec: T0,
      untilSec: T0 + 2 * DAY,
      relays: [{ url: "wss://r", events: events.length }],
      events,
    });
    expect(report).toContain("## Referrals");
    expect(report).toContain("Referred airlines: 2 of 3 created (67%), from 1 referring player.");
    expect(report).not.toContain(A);
    expect(report).not.toContain(B);
  });

  it("says so when nobody was referred", () => {
    const events = collectFunnelEvents([action(A, T0, "AIRLINE_CREATE")], WORLD);
    const report = formatFunnelReport({
      worldId: WORLD,
      sinceSec: T0,
      untilSec: T0 + DAY,
      relays: [],
      events,
    });
    expect(report).toContain("No referred airlines yet");
  });
});
