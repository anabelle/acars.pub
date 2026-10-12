import { describe, expect, it } from "vitest";
import {
  CALM,
  decodeWeather,
  describeWeather,
  encodeWeather,
  parseMetar,
  weatherDelayTicks,
} from "./weather.js";
import { TICKS_PER_HOUR } from "./types.js";

const MIN = TICKS_PER_HOUR / 60;

describe("parseMetar", () => {
  it("reads a clear day as VFR", () => {
    expect(parseMetar("METAR LEMD 121430Z 24008KT CAVOK 22/08 Q1018 NOSIG")).toEqual(CALM);
    expect(parseMetar("KJFK 121451Z 18012KT 10SM FEW250 22/12 A3002")).toEqual(CALM);
  });

  it("reads categories from ceiling and visibility (statute miles and metres)", () => {
    expect(parseMetar("KSFO 121456Z 28010KT 4SM BR BKN025 15/12 A2998").category).toBe(1);
    expect(parseMetar("KSFO 121456Z 28010KT 2SM BR OVC008 15/12 A2998").category).toBe(2);
    expect(parseMetar("KSFO 121456Z 00000KT 1/4SM FG VV002 12/12 A2998")).toMatchObject({
      category: 3,
      fog: true,
    });
    expect(parseMetar("KBOS 121456Z 05015KT 1 1/2SM -SN OVC015 M02/M04 A2990")).toMatchObject({
      category: 2,
      snow: true,
    });
    expect(parseMetar("EGLL 121450Z 25012KT 0800 FG VV001 08/08 Q1012").category).toBe(3);
  });

  it("reads gusts and thunderstorms, and ignores remarks", () => {
    const storm = parseMetar("KDFW 122153Z 22018G38KT 3SM +TSRA BKN030CB 28/22 A2985 RMK SN");
    expect(storm).toMatchObject({ thunderstorm: true, gustKt: 38, snow: false });
    expect(parseMetar("UUEE 121400Z 27010G15MPS 9999 BKN040 05/01 Q1005").gustKt).toBe(29);
    expect(parseMetar("garbage")).toEqual(CALM);
  });
});

describe("compact form", () => {
  it("round-trips and rejects bad input", () => {
    const f = { category: 2 as const, gustKt: 32, thunderstorm: true, fog: false, snow: true };
    expect(decodeWeather(encodeWeather(f))).toEqual(f);
    expect(decodeWeather([4, 0, 0])).toBeNull();
    expect(decodeWeather([0, -1, 0])).toBeNull();
    expect(decodeWeather([0, 0, 9])).toBeNull();
    expect(decodeWeather("x")).toBeNull();
  });
});

describe("weatherDelayTicks", () => {
  it("is zero in calm weather and grows with worse weather, deterministically", () => {
    expect(weatherDelayTicks(CALM, "a")).toBe(0);
    const ifr = weatherDelayTicks({ ...CALM, category: 2 }, "a");
    expect(ifr).toBeGreaterThanOrEqual(10 * MIN);
    expect(ifr).toBeLessThanOrEqual(30 * MIN);
    const worst = weatherDelayTicks(
      { category: 3, gustKt: 45, thunderstorm: true, fog: true, snow: true },
      "a",
    );
    expect(worst).toBeGreaterThanOrEqual(90 * MIN);
    expect(weatherDelayTicks({ ...CALM, category: 1 }, "x")).toBe(
      weatherDelayTicks({ ...CALM, category: 1 }, "x"),
    );
  });

  it("describes weather in ACARS style", () => {
    expect(describeWeather(CALM)).toBe("VFR");
    expect(
      describeWeather({ category: 2, gustKt: 32, thunderstorm: true, fog: true, snow: true }),
    ).toBe("IFR · TS · FG · SN · G32");
  });
});
