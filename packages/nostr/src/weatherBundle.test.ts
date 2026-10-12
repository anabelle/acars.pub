import { CALM } from "@acars/core";
import { describe, expect, it } from "vitest";
import {
  buildWeatherEvent,
  parseWeatherEvent,
  weatherDTag,
  weatherHourKey,
  weatherHourStartMs,
} from "./weatherBundle";

const KEY = "a".repeat(64);
const issued = Date.UTC(2026, 9, 12, 14, 5);
const storm = { category: 2 as const, gustKt: 38, thunderstorm: true, fog: false, snow: false };

describe("weather hours", () => {
  it("keys and parses UTC hours", () => {
    expect(weatherHourKey(issued)).toBe("2026101214");
    expect(weatherHourStartMs("2026101214")).toBe(Date.UTC(2026, 9, 12, 14));
    expect(weatherHourStartMs("2026133014")).toBeNull();
    expect(weatherHourStartMs("x")).toBeNull();
    expect(weatherDTag("2026101214")).toBe("airtr:world:v6-beta:weather:2026101214");
  });
});

describe("weather events", () => {
  const event = {
    ...buildWeatherEvent({
      issuedAtMs: issued,
      airports: new Map([
        ["DFW", storm],
        ["MAD", CALM],
      ]),
    }),
    pubkey: KEY,
  };

  it("round-trips a bundle from the weather key", () => {
    const bundle = parseWeatherEvent(event, KEY);
    expect(bundle?.hourKey).toBe("2026101214");
    expect(bundle?.airports.get("DFW")).toEqual(storm);
    expect(bundle?.airports.get("MAD")).toEqual(CALM);
  });

  it("rejects other authors, wrong tags, hours, content and airports", () => {
    expect(parseWeatherEvent(event, "b".repeat(64))).toBeNull();
    expect(parseWeatherEvent(event, "")).toBeNull();
    expect(parseWeatherEvent({ ...event, kind: 1 }, KEY)).toBeNull();
    expect(parseWeatherEvent({ ...event, tags: [["d", "other"]] }, KEY)).toBeNull();
    expect(
      parseWeatherEvent({ ...event, tags: [["d", weatherDTag("2026101215")]] }, KEY),
    ).toBeNull();
    expect(parseWeatherEvent({ ...event, content: "{" }, KEY)).toBeNull();
    expect(parseWeatherEvent({ ...event, content: "null" }, KEY)).toBeNull();
    const bad = (airports: unknown) =>
      parseWeatherEvent(
        { ...event, content: JSON.stringify({ issued: new Date(issued).toISOString(), airports }) },
        KEY,
      );
    expect(bad({ dfw: [0, 0, 0] })).toBeNull();
    expect(bad({ DFW: [9, 0, 0] })).toBeNull();
    expect(bad(null)).toBeNull();
    expect(bad({ DFW: [0, 0, 0] })?.airports.size).toBe(1);
  });
});
