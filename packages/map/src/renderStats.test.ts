import { afterEach, describe, expect, it } from "vitest";
import { mapRenderStats, trackMapRenders } from "./renderStats";

afterEach(() => {
  delete (globalThis as { __acarsMapStats?: unknown }).__acarsMapStats;
});

describe("map render stats", () => {
  it("is one shared counter object on the page", () => {
    const stats = mapRenderStats();
    expect(stats).toEqual({ renders: 0, requests: 0, lowPower: false });
    expect(mapRenderStats()).toBe(stats);
    expect((globalThis as { __acarsMapStats?: unknown }).__acarsMapStats).toBe(stats);
  });

  it("counts the map's render events", () => {
    const handlers: Record<string, () => void> = {};
    trackMapRenders({
      on: ((event: string, handler: () => void) => {
        handlers[event] = handler;
      }) as never,
    });
    handlers.render();
    handlers.render();
    expect(mapRenderStats().renders).toBe(2);
  });
});
