import { describe, expect, it } from "vitest";
import { buildContrailImage, TRAIL_LENGTH, TRAIL_WIDTH } from "./trail.js";

describe("buildContrailImage()", () => {
  const image = buildContrailImage(2);
  const alpha = (x: number, y: number) => image.data[(y * image.width + x) * 4 + 3];
  const row = (y: number) => Array.from({ length: image.width }, (_, x) => alpha(x, y));

  it("is white, at the device pixel ratio", () => {
    expect(image.width).toBe(TRAIL_WIDTH * 2);
    expect(image.height).toBe(TRAIL_LENGTH * 2);
    expect(image.data.length).toBe(image.width * image.height * 4);
    expect([...image.data.subarray(0, 3)]).toEqual([255, 255, 255]);
  });

  it("is strongest at the aircraft and fades to nothing at the end", () => {
    const centre = Math.floor(image.width / 2);
    const strengths = [0, 40, 80, 120, image.height - 1].map((y) => alpha(centre, y));
    for (let i = 1; i < strengths.length; i++) {
      expect(strengths[i]).toBeLessThan(strengths[i - 1]);
    }
    expect(strengths[0]).toBeGreaterThan(200);
    expect(strengths[strengths.length - 1]).toBe(0);
  });

  it("widens along its length with soft, transparent edges", () => {
    const covered = (y: number) => row(y).filter((a) => a > 0).length;
    expect(covered(60)).toBeGreaterThan(covered(2));
    expect(alpha(0, 2)).toBe(0);
    expect(alpha(image.width - 1, 2)).toBe(0);
  });
});
