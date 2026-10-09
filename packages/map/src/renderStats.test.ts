import { afterEach, describe, expect, it, vi } from "vitest";
import {
  exposeMapTestHandle,
  type MapTestHandle,
  mapRenderStats,
  trackMapRenders,
} from "./renderStats";

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

describe("exposeMapTestHandle()", () => {
  it("projects to page pixels, moves the camera and cleans up after itself", () => {
    const map = {
      project: () => ({ x: 10, y: 20 }),
      jumpTo: vi.fn(),
      getContainer: () => ({ getBoundingClientRect: () => ({ left: 100, top: 50 }) }),
    };
    const remove = exposeMapTestHandle(map as never);
    const handle = (globalThis as { __acarsMapTest?: MapTestHandle }).__acarsMapTest;
    expect(handle?.project(2, 41)).toEqual([110, 70]);
    handle?.jumpTo([1, 2], 5);
    expect(map.jumpTo).toHaveBeenCalledWith({ center: [1, 2], zoom: 5, pitch: 0, bearing: 0 });
    remove();
    expect((globalThis as { __acarsMapTest?: unknown }).__acarsMapTest).toBeUndefined();
  });
});
