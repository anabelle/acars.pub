import { describe, expect, it } from "vitest";
import {
  departureDisruptionTicks,
  firstLineDay,
  type LineLeg,
  type LineOfFlying,
  lineDay,
  lineLandingCount,
  lineLandingsBetween,
  linePhaseAt,
  utcDayOf,
  utcDayStartTick,
  utcTimeOfDayTicks,
  validateLine,
} from "./line.js";
import { GENESIS_TIME, TICK_DURATION, TICKS_PER_DAY, TICKS_PER_HOUR } from "./types.js";

const H = TICKS_PER_HOUR;
const leg = (o: string, d: string, depH: number, durH = 1.5, turnMin = 40): LineLeg => ({
  routeId: `${o}-${d}`,
  originIata: o,
  destinationIata: d,
  departOffsetTicks: Math.round(depH * H),
  durationTicks: Math.round(durH * H),
  turnaroundTicks: (turnMin * H) / 60,
});
// MAD→BCN 07:00, BCN→LIS 09:30, LIS→MAD 12:30, MAD→BCN 15:00, BCN→MAD 17:30
const legs = [
  leg("MAD", "BCN", 7),
  leg("BCN", "LIS", 9.5, 2),
  leg("LIS", "MAD", 12.5, 1.25),
  leg("MAD", "BCN", 15),
  leg("BCN", "MAD", 17.5),
];
const line: LineOfFlying = { legs, startTick: utcDayStartTick(100) };

describe("UTC days", () => {
  it("map ticks to real UTC days (the genesis is at 18:00Z, not midnight)", () => {
    const tick = (iso: string) => (Date.parse(iso) - GENESIS_TIME) / TICK_DURATION;
    expect(utcTimeOfDayTicks(tick("2026-10-12T03:00:00Z"))).toBe(3 * H);
    expect(utcTimeOfDayTicks(tick("2026-10-12T00:00:00Z"))).toBe(0);
    expect(utcDayOf(tick("2026-10-12T23:59:57Z"))).toBe(utcDayOf(tick("2026-10-12T00:00:00Z")));
    expect(utcDayStartTick(utcDayOf(tick("2026-10-12T15:00:00Z")))).toBe(
      tick("2026-10-12T00:00:00Z"),
    );
    const [first] = lineDay(line, "a1", utcDayOf(tick("2026-10-12T12:00:00Z")));
    expect(utcTimeOfDayTicks(first.scheduledDepartureTick)).toBe(7 * H);
  });
});

describe("validateLine", () => {
  it("accepts a closed chain that fits the day", () => {
    expect(validateLine(legs)).toBeNull();
  });
  it("names what is wrong", () => {
    expect(validateLine([])).toBe("empty");
    expect(validateLine([legs[0], legs[2]])).toBe("not-chained");
    expect(
      validateLine([legs[0], { ...legs[1], departOffsetTicks: legs[0].departOffsetTicks + H }]),
    ).toBe("overlap");
    expect(validateLine([legs[0], legs[1]])).toBe("not-closed");
    expect(validateLine([{ ...legs[0], departOffsetTicks: TICKS_PER_DAY }])).toBe("bad-offset");
    expect(
      validateLine([leg("MAD", "JFK", 1, 8.5, 60), leg("JFK", "MAD", 11, 7.5, 60)]),
    ).toBeNull();
    expect(validateLine([leg("MAD", "JFK", 1, 12, 60), leg("JFK", "MAD", 14, 12, 60)])).toBe(
      "too-long",
    );
  });
});

describe("departureDisruptionTicks", () => {
  it("is deterministic and mostly zero", () => {
    expect(departureDisruptionTicks("a1", 5, 2)).toBe(departureDisruptionTicks("a1", 5, 2));
    let onTime = 0;
    for (let d = 0; d < 1000; d++) if (departureDisruptionTicks("a1", d, 0) === 0) onTime++;
    expect(onTime).toBeGreaterThan(550);
    expect(onTime).toBeLessThan(780);
  });
});

describe("lineDay", () => {
  it("flies nothing before the first day, then every leg in order", () => {
    expect(firstLineDay(line)).toBe(100);
    expect(lineDay(line, "a1", 99)).toEqual([]);
    const day = lineDay(line, "a1", 101);
    expect(day.map((f) => f.legIndex)).toEqual([0, 1, 2, 3, 4]);
    for (let i = 0; i < day.length; i++) {
      expect(day[i].departureTick).toBeGreaterThanOrEqual(day[i].scheduledDepartureTick);
      if (i > 0) {
        expect(day[i].departureTick).toBeGreaterThanOrEqual(
          day[i - 1].arrivalTick + day[i - 1].leg.turnaroundTicks,
        );
      }
    }
  });

  it("never lets a day's delays spill into the next day", () => {
    const tight: LineOfFlying = {
      legs: [leg("MAD", "JFK", 10, 9, 60), leg("JFK", "MAD", 20.5, 8, 60)],
      startTick: 0,
    };
    expect(validateLine(tight.legs)).toBeNull();
    for (let d = firstLineDay(tight); d < firstLineDay(tight) + 400; d++) {
      const [, back] = lineDay(tight, "x", d);
      const next = lineDay(tight, "x", d + 1)[0];
      expect(back.arrivalTick + back.leg.turnaroundTicks).toBeLessThanOrEqual(next.departureTick);
    }
  });
});

describe("linePhaseAt", () => {
  it("waits at the first origin before the line starts", () => {
    const phase = linePhaseAt(line, "a1", line.startTick - H);
    expect(phase.status).toBe("idle");
    expect(phase.airportIata).toBe("MAD");
    expect(phase.next?.legIndex).toBe(0);
  });

  it("is in the air, turning around or waiting as the day goes", () => {
    const [first, second] = lineDay(line, "a1", 102);
    expect(linePhaseAt(line, "a1", first.departureTick + 1).status).toBe("enroute");
    const turning = linePhaseAt(line, "a1", first.arrivalTick + 1);
    expect(turning.status).toBe("turnaround");
    expect(turning.airportIata).toBe("BCN");
    if (second.departureTick > first.arrivalTick + first.leg.turnaroundTicks + 1) {
      const waiting = linePhaseAt(line, "a1", first.arrivalTick + first.leg.turnaroundTicks + 1);
      expect(waiting.status).toBe("idle");
      expect(waiting.next?.legIndex).toBe(1);
    }
    const night = linePhaseAt(line, "a1", utcDayStartTick(102) + 23 * H);
    expect(night.status).toBe("idle");
    expect(night.airportIata).toBe("MAD");
  });
});

describe("landings", () => {
  it("counts agree with walking every day, for short and long spans", () => {
    for (const [from, to] of [
      [line.startTick, line.startTick + 3 * H],
      [line.startTick + 5 * H, line.startTick + 2 * TICKS_PER_DAY + 9 * H],
      [line.startTick - TICKS_PER_DAY, line.startTick + 40 * TICKS_PER_DAY + 13 * H],
    ]) {
      const walked = lineLandingsBetween(line, "a1", from, to, 100_000);
      const counts = lineLandingCount(line, "a1", from, to);
      expect(counts.reduce((a, b) => a + b, 0)).toBe(walked.length);
      for (let i = 0; i < legs.length; i++) {
        expect(counts[i]).toBe(walked.filter((f) => f.legIndex === i).length);
      }
    }
  });

  it("keeps the newest landings when capped", () => {
    const from = line.startTick;
    const to = line.startTick + 30 * TICKS_PER_DAY;
    const capped = lineLandingsBetween(line, "a1", from, to, 7);
    expect(capped).toHaveLength(7);
    const all = lineLandingsBetween(line, "a1", from, to, 100_000);
    expect(capped).toEqual(all.slice(-7));
  });
});
