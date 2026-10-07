import { describe, expect, it } from "vitest";
import { PLAY_PROTOTYPE_STORAGE_KEY, resolvePlayPrototypeFlag } from "./playFlag";

const memory = () => {
  const state = new Map<string, string>();
  return {
    state,
    getItem: (key: string) => state.get(key) ?? null,
    setItem: (key: string, value: string) => void state.set(key, value),
    removeItem: (key: string) => void state.delete(key),
  };
};

describe("resolvePlayPrototypeFlag()", () => {
  it("is off by default", () => {
    expect(resolvePlayPrototypeFlag("", { buildFlag: undefined, storage: memory() })).toBe(false);
  });

  it("turns on for this browser with ?prototype=on and off with ?prototype=off", () => {
    const storage = memory();
    expect(resolvePlayPrototypeFlag("?prototype=on", { buildFlag: undefined, storage })).toBe(true);
    expect(storage.state.get(PLAY_PROTOTYPE_STORAGE_KEY)).toBe("1");
    expect(resolvePlayPrototypeFlag("", { buildFlag: undefined, storage })).toBe(true);
    expect(resolvePlayPrototypeFlag("?prototype=off", { buildFlag: undefined, storage })).toBe(
      false,
    );
    expect(resolvePlayPrototypeFlag("", { buildFlag: undefined, storage })).toBe(false);
  });

  it("is on for builds made with VITE_PLAY_PROTOTYPE=1", () => {
    expect(resolvePlayPrototypeFlag("", { buildFlag: "1", storage: memory() })).toBe(true);
  });

  it("survives blocked storage", () => {
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(
      resolvePlayPrototypeFlag("?prototype=on", { buildFlag: undefined, storage: blocked }),
    ).toBe(true);
    expect(resolvePlayPrototypeFlag("", { buildFlag: undefined, storage: blocked })).toBe(false);
    expect(resolvePlayPrototypeFlag("", { buildFlag: undefined, storage: null })).toBe(false);
  });
});
