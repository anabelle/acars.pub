import { describe, expect, it } from "vitest";
import {
  ATR_BODY_SVG,
  ATR_ACCENT_SVG,
  DASH8_BODY_SVG,
  DASH8_ACCENT_SVG,
  A220_BODY_SVG,
  A220_ACCENT_SVG,
  EJET_BODY_SVG,
  EJET_ACCENT_SVG,
  A320_BODY_SVG,
  A320_ACCENT_SVG,
  B737_BODY_SVG,
  B737_ACCENT_SVG,
  A330_BODY_SVG,
  A330_ACCENT_SVG,
  B787_BODY_SVG,
  B787_ACCENT_SVG,
  B777_BODY_SVG,
  B777_ACCENT_SVG,
  A350_BODY_SVG,
  A350_ACCENT_SVG,
  A380_BODY_SVG,
  A380_ACCENT_SVG,
  B747_BODY_SVG,
  B747_ACCENT_SVG,
  FAMILY_ICONS,
  // Backward-compatible aliases
  NARROWBODY_SVG,
  TURBOPROP_SVG,
  WIDEBODY_SVG,
  REGIONAL_SVG,
  NARROWBODY_ACCENT_SVG,
  TURBOPROP_ACCENT_SVG,
  WIDEBODY_ACCENT_SVG,
  REGIONAL_ACCENT_SVG,
  NARROWBODY_BODY_SVG,
  TURBOPROP_BODY_SVG,
  WIDEBODY_BODY_SVG,
  REGIONAL_BODY_SVG,
} from "./icons.js";

const familySvgs = [
  ATR_BODY_SVG,
  ATR_ACCENT_SVG,
  DASH8_BODY_SVG,
  DASH8_ACCENT_SVG,
  A220_BODY_SVG,
  A220_ACCENT_SVG,
  EJET_BODY_SVG,
  EJET_ACCENT_SVG,
  A320_BODY_SVG,
  A320_ACCENT_SVG,
  B737_BODY_SVG,
  B737_ACCENT_SVG,
  A330_BODY_SVG,
  A330_ACCENT_SVG,
  B787_BODY_SVG,
  B787_ACCENT_SVG,
  B777_BODY_SVG,
  B777_ACCENT_SVG,
  A350_BODY_SVG,
  A350_ACCENT_SVG,
  A380_BODY_SVG,
  A380_ACCENT_SVG,
  B747_BODY_SVG,
  B747_ACCENT_SVG,
];

const EXPECTED_FAMILIES = [
  "atr",
  "dash8",
  "a220",
  "ejet",
  "a320",
  "b737",
  "a330",
  "b787",
  "b777",
  "a350",
  "a380",
  "b747",
];

describe("icons", () => {
  it("exports 24 family SVG strings", () => {
    expect(familySvgs).toHaveLength(24);
    for (const svg of familySvgs) {
      expect(typeof svg).toBe("string");
      expect(svg.length).toBeGreaterThan(0);
      expect(svg).toContain("<svg");
    }
  });

  it("all SVGs use 48x48 dimensions", () => {
    for (const svg of familySvgs) {
      expect(svg).toContain('width="48"');
      expect(svg).toContain('height="48"');
    }
  });

  it("FAMILY_ICONS map contains all 12 families", () => {
    for (const familyId of EXPECTED_FAMILIES) {
      expect(FAMILY_ICONS).toHaveProperty(familyId);
      expect(FAMILY_ICONS[familyId]).toHaveProperty("body");
      expect(FAMILY_ICONS[familyId]).toHaveProperty("accent");
      expect(FAMILY_ICONS[familyId].body).toContain("<svg");
      expect(FAMILY_ICONS[familyId].accent).toContain("<svg");
    }
    expect(Object.keys(FAMILY_ICONS)).toHaveLength(EXPECTED_FAMILIES.length);
  });

  it("backward-compatible aliases resolve correctly", () => {
    expect(NARROWBODY_SVG).toBe(A320_BODY_SVG);
    expect(TURBOPROP_SVG).toBe(ATR_BODY_SVG);
    expect(WIDEBODY_SVG).toBe(B787_BODY_SVG);
    expect(REGIONAL_SVG).toBe(A220_BODY_SVG);

    expect(NARROWBODY_ACCENT_SVG).toBe(A320_ACCENT_SVG);
    expect(TURBOPROP_ACCENT_SVG).toBe(ATR_ACCENT_SVG);
    expect(WIDEBODY_ACCENT_SVG).toBe(B787_ACCENT_SVG);
    expect(REGIONAL_ACCENT_SVG).toBe(A220_ACCENT_SVG);

    expect(NARROWBODY_BODY_SVG).toBe(NARROWBODY_SVG);
    expect(TURBOPROP_BODY_SVG).toBe(TURBOPROP_SVG);
    expect(WIDEBODY_BODY_SVG).toBe(WIDEBODY_SVG);
    expect(REGIONAL_BODY_SVG).toBe(REGIONAL_SVG);
  });
});
