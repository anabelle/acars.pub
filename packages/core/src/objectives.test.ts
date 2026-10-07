import { describe, expect, it } from "vitest";
import { fp } from "./fixed-point.js";
import {
  DAILY_OBJECTIVE_COUNT,
  getDailyObjectives,
  OBJECTIVE_TEMPLATES,
  objectiveDayWindow,
  utcDateForTick,
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
      ]
    `);
  });

  it("gives three distinct kinds a day, with variants from the template table", () => {
    for (const date of datesFrom("2026-01-01", 400)) {
      const objectives = getDailyObjectives(date);
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
    expect(seen.size).toBe(OBJECTIVE_TEMPLATES.length);
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
