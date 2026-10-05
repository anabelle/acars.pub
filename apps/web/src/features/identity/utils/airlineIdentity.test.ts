import { describe, expect, it } from "vitest";
import { suggestCallsign, suggestIcaoCode, suggestLivery } from "./airlineIdentity";

const none = new Set<string>();

describe("suggestIcaoCode", () => {
  it("uses the initials or the first letters of the name", () => {
    expect(suggestIcaoCode("Trans Atlantic Wings", none)).toBe("TAW");
    expect(suggestIcaoCode("Air Europa", none)).toBe("AEU");
    expect(suggestIcaoCode("Iberia", none)).toBe("IBE");
  });

  it("strips accents and symbols", () => {
    expect(suggestIcaoCode("Ñandú Aérea", none)).toBe("NAE");
    expect(suggestIcaoCode("  sky-high 7  ", none)).toBe("SHI");
  });

  it("skips codes other airlines already use", () => {
    expect(suggestIcaoCode("Iberia", new Set(["IBE"]))).toBe("IBR");
    const code = suggestIcaoCode("Air Europa", new Set(["AEU", "AIE", "AIR"]));
    expect(code).toHaveLength(3);
    expect(["AEU", "AIE", "AIR"]).not.toContain(code);
  });

  it("always returns three letters, even for short or empty names", () => {
    expect(suggestIcaoCode("Jo", none)).toMatch(/^[A-Z]{3}$/);
    expect(suggestIcaoCode("", none)).toMatch(/^[A-Z]{3}$/);
    expect(suggestIcaoCode("!!!", new Set(["AAA"]))).toMatch(/^[A-Z]{3}$/);
  });

  it("is deterministic", () => {
    expect(suggestIcaoCode("Jo", none)).toBe(suggestIcaoCode("Jo", none));
  });
});

describe("suggestCallsign and suggestLivery", () => {
  it("calls the airline by its first word", () => {
    expect(suggestCallsign("Iberia Express", "IBE")).toBe("IBERIA");
    expect(suggestCallsign("Supercalifragilistic Air", "SUP")).toBe("SUPERCALIFRA");
    expect(suggestCallsign("", "XYZ")).toBe("XYZ");
  });

  it("derives stable, valid hex colours from the name", () => {
    const livery = suggestLivery("Air Europa");
    expect(livery.primary).toMatch(/^#[0-9a-f]{6}$/);
    expect(livery.secondary).toMatch(/^#[0-9a-f]{6}$/);
    expect(livery.primary).not.toBe(livery.secondary);
    expect(suggestLivery("Air Europa")).toEqual(livery);
    expect(suggestLivery("Iberia")).not.toEqual(livery);
  });
});
