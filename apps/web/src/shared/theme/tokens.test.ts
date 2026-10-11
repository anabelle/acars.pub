import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { COCKPIT, contrastRatio, HI_VIS, ND, RAMP, SIGN } from "./tokens";

const css = readFileSync(resolve(__dirname, "../../index.css"), "utf8");

function cssVar(name: string): string {
  const match = new RegExp(`--${name}:\\s*(\\d+) (\\d+) (\\d+);`).exec(css);
  if (!match) throw new Error(`--${name} missing from index.css`);
  return `#${match
    .slice(1, 4)
    .map((n) => Number(n).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

describe("Cockpit + Ramp tokens (S59)", () => {
  it("index.css and tokens.ts agree", () => {
    const pairs: Array<[string, string]> = [
      ...Object.entries(COCKPIT).map(([k, v]) => [`cockpit-${k}`, v] as [string, string]),
      ...Object.entries(ND).map(([k, v]) => [`nd-${k}`, v] as [string, string]),
      ...Object.entries(RAMP).map(([k, v]) => [`ramp-${k}`, v] as [string, string]),
      ...Object.entries(SIGN).map(([k, v]) => [`sign-${k}`, v] as [string, string]),
      ["hi-vis", HI_VIS],
    ];
    for (const [name, hex] of pairs) expect(cssVar(name), name).toBe(hex);
  });

  it("text pairs meet 4.5:1", () => {
    const pairs: Array<[string, string]> = [
      [ND.white, COCKPIT.bg],
      [ND.white, COCKPIT.panel],
      [ND.cyan, COCKPIT.bg],
      [ND.green, COCKPIT.bg],
      [ND.amber, COCKPIT.bg],
      [ND.magenta, COCKPIT.bg],
      [ND.red, COCKPIT.bg],
      [ND.white, SIGN.red],
      [RAMP.paint, RAMP.asphalt],
      [RAMP.paint, RAMP.slab],
      [SIGN.yellow, SIGN.black],
      [SIGN.black, SIGN.yellow],
      [SIGN.black, HI_VIS],
    ];
    for (const [fg, bg] of pairs)
      expect(contrastRatio(fg, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
  });

  it("computes WCAG contrast", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#777777")).toBe(1);
  });
});
