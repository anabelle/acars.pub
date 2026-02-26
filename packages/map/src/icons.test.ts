import { describe, expect, it } from "vitest";
import {
  NARROWBODY_SVG,
  TURBOPROP_SVG,
  WIDEBODY_SVG,
  REGIONAL_SVG,
  NARROWBODY_ACCENT_SVG,
  TURBOPROP_ACCENT_SVG,
  WIDEBODY_ACCENT_SVG,
  REGIONAL_ACCENT_SVG,
} from "./icons.js";

const svgSnippets = [
  NARROWBODY_SVG,
  TURBOPROP_SVG,
  WIDEBODY_SVG,
  REGIONAL_SVG,
  NARROWBODY_ACCENT_SVG,
  TURBOPROP_ACCENT_SVG,
  WIDEBODY_ACCENT_SVG,
  REGIONAL_ACCENT_SVG,
];

describe("icons", () => {
  it("exports svg snippets", () => {
    for (const svg of svgSnippets) {
      expect(typeof svg).toBe("string");
      expect(svg.length).toBeGreaterThan(0);
      expect(svg.includes("<svg")).toBe(true);
    }
  });
});
