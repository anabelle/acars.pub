import { describe, expect, it } from "vitest";
import {
  CHECKPOINT_TYPE,
  FUNNEL_WORLD_ID,
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
function action(pubkey: string, createdAt: number, type: string, world = WORLD): RawNostrEvent {
  nextId += 1;
  return {
    id: `e${nextId}`,
    pubkey,
    created_at: createdAt,
    kind: 30078,
    tags: [["d", `airtr:world:${world}:action:${type.toLowerCase()}`]],
    content: JSON.stringify({ schemaVersion: 2, action: type, payload: {} }),
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

  it("reads checkpoints", () => {
    const event = { ...action("a", T0, "X"), tags: [["d", `airtr:world:${WORLD}:checkpoint`]] };
    expect(parseFunnelEvent(event, WORLD)?.type).toBe(CHECKPOINT_TYPE);
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
