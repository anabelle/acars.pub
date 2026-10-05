import { describe, expect, it } from "vitest";
import { LONG_HOP_KM, planCameraFlight } from "./camera.js";
import { globeFitZoom } from "./layers/globeView.js";

const MAD = { lng: -3.57, lat: 40.47 };
const BCN = { lng: 2.08, lat: 41.3 };
const SYD = { lng: 151.18, lat: -33.95 };
const viewport = { width: 1440, height: 900 };

describe("planCameraFlight", () => {
  it("keeps short hops quick and low", () => {
    const plan = planCameraFlight(MAD, BCN, { current: 4.5, target: 4.5 }, viewport);
    expect(plan.duration).toBeGreaterThanOrEqual(1200);
    expect(plan.duration).toBeLessThan(1500);
    expect(plan.minZoom).toBeUndefined();
  });

  it("takes long hops through space and gives them more time", () => {
    const plan = planCameraFlight(MAD, SYD, { current: 4.5, target: 4.5 }, viewport);
    expect(plan.duration).toBe(4000);
    expect(plan.minZoom).toBe(globeFitZoom(viewport.width, viewport.height));
  });

  it("never zooms the path in past where the camera already is", () => {
    const plan = planCameraFlight(MAD, SYD, { current: -0.5, target: 4.5 }, viewport);
    expect(plan.minZoom).toBe(-0.5);
  });

  it("treats the long-hop threshold as the start of a space flight", () => {
    // ~2,600 km: Madrid to Moscow is over the threshold.
    const plan = planCameraFlight(
      MAD,
      { lng: 37.62, lat: 55.75 },
      { current: 4, target: 4 },
      viewport,
    );
    expect(LONG_HOP_KM).toBeLessThan(3500);
    expect(plan.minZoom).toBeDefined();
  });
});
