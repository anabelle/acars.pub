import { CALM } from "@acars/core";
import { describe, expect, it, vi } from "vitest";
import { buildWeatherEvent } from "./weatherBundle";

const KEY = "c".repeat(64);
const now = Date.UTC(2026, 9, 12, 14, 30);
const events: object[] = [];
const filters: unknown[] = [];

vi.mock("./ndk.js", () => ({
  ensureConnected: vi.fn().mockResolvedValue(undefined),
  getNDK: () => ({
    subscribe: (filter: unknown) => {
      filters.push(filter);
      const handlers: Record<string, (value?: unknown) => void> = {};
      queueMicrotask(() => {
        for (const raw of events) handlers.event?.({ rawEvent: () => raw });
        handlers.eose?.();
      });
      return {
        on: (name: string, fn: (value?: unknown) => void) => {
          handlers[name] = fn;
        },
        stop: vi.fn(),
      };
    },
  }),
}));

import { loadWeatherBundles } from "./weather";

describe("loadWeatherBundles", () => {
  it("asks the weather key for the last hours and keeps valid bundles, newest per hour", async () => {
    const storm = { ...CALM, thunderstorm: true };
    events.push(
      {
        ...buildWeatherEvent({ issuedAtMs: now - 60_000, airports: new Map([["DFW", CALM]]) }),
        pubkey: KEY,
      },
      {
        ...buildWeatherEvent({ issuedAtMs: now, airports: new Map([["DFW", storm]]) }),
        pubkey: KEY,
      },
      {
        ...buildWeatherEvent({ issuedAtMs: now, airports: new Map([["DFW", CALM]]) }),
        pubkey: "d".repeat(64),
      },
    );
    const bundles = await loadWeatherBundles(KEY, now, 2);
    expect(filters[0]).toMatchObject({ kinds: [30078], authors: [KEY] });
    expect((filters[0] as { "#d": string[] })["#d"]).toHaveLength(2);
    expect(bundles.get("2026101214")?.airports.get("DFW")).toEqual(storm);
  });

  it("does nothing without a valid key", async () => {
    expect((await loadWeatherBundles("", now)).size).toBe(0);
  });
});
