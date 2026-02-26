import { describe, expect, it, vi } from "vitest";

vi.mock("./engine.js", () => {
  return {
    useEngineStore: {
      subscribe: vi.fn(),
      getState: vi.fn(() => ({
        tick: 0,
      })),
    },
  };
});

import { useAirlineStore } from "./airline.js";

describe("airline store", () => {
  it("creates a zustand store with slices", () => {
    const state = useAirlineStore.getState();
    expect(state).toBeDefined();
    expect(typeof state.initializeIdentity).toBe("function");
    expect(typeof state.processTick).toBe("function");
    expect(typeof state.processGlobalTick).toBe("function");
  });
});
