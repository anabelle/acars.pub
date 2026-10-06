import { describe, expect, it, vi } from "vitest";
import {
  BURST_DURATION_MS,
  BURST_POOL_SIZE,
  BURST_RISE_PX,
  BurstPool,
  type BurstSlot,
  burstKeyframes,
  burstStyle,
  createMarkerSlot,
  type MapBurst,
  type MarkerLike,
  prefersReducedMotion,
} from "./bursts.js";

const burst = (id: string, tone: MapBurst["tone"] = "gain"): MapBurst => ({
  id,
  longitude: 1,
  latitude: 2,
  text: `+$${id}`,
  tone,
});

/** A pool over recording slots, with a manual clock and timers. */
function harness(size = BURST_POOL_SIZE) {
  let now = 0;
  const pending = new Map<number, () => void>();
  let nextTimer = 1;
  const slots: Array<{ shown: string[]; hidden: number } & BurstSlot> = [];
  const pool = new BurstPool(
    () => {
      const slot = {
        shown: [] as string[],
        hidden: 0,
        show(b: MapBurst) {
          slot.shown.push(b.id);
        },
        hide() {
          slot.hidden++;
        },
      };
      slots.push(slot);
      return slot;
    },
    () => now,
    {
      set: (callback, ms) => {
        const id = nextTimer++;
        pending.set(id, () => {
          if (ms === BURST_DURATION_MS) callback();
        });
        return id;
      },
      clear: (handle) => pending.delete(handle as number),
    },
    size,
  );
  return {
    pool,
    slots,
    advance(ms: number) {
      now += ms;
    },
    fireAll() {
      const callbacks = [...pending.values()];
      pending.clear();
      for (const callback of callbacks) callback();
    },
  };
}

describe("BurstPool", () => {
  it("shows each burst once, however often it is pushed", () => {
    const { pool, slots } = harness();
    expect(pool.push([burst("a"), burst("b")])).toBe(2);
    expect(pool.push([burst("a"), burst("b"), burst("c")])).toBe(1);
    expect(slots.flatMap((s) => s.shown)).toEqual(["a", "b", "c"]);
    expect(pool.active).toBe(3);
  });

  it("never creates more than the pool size, recycling the oldest label", () => {
    const { pool, slots, advance } = harness(3);
    for (const id of ["a", "b", "c", "d", "e"]) {
      pool.push([burst(id)]);
      advance(10);
    }
    expect(slots).toHaveLength(3);
    expect(pool.active).toBe(3);
    // "d" replaced "a" (oldest), then "e" replaced "b".
    expect(slots[0].shown).toEqual(["a", "d"]);
    expect(slots[1].shown).toEqual(["b", "e"]);
  });

  it("hides labels after their lifetime and reuses free slots", () => {
    const { pool, slots, fireAll } = harness();
    pool.push([burst("a"), burst("b")]);
    fireAll();
    expect(pool.active).toBe(0);
    pool.push([burst("c")]);
    expect(slots).toHaveLength(2);
    expect(slots[0].shown).toEqual(["a", "c"]);
  });

  it("clears every label at once", () => {
    const { pool, slots } = harness();
    pool.push([burst("a"), burst("b")]);
    pool.clear();
    expect(pool.active).toBe(0);
    expect(slots.every((s) => s.hidden >= 2)).toBe(true);
  });

  it("forgets old ids beyond its memory bound", () => {
    const { pool } = harness();
    for (let i = 0; i < 210; i++) pool.push([burst(`id${i}`)]);
    // The first ids were dropped from memory, so they could show again.
    expect(pool.push([burst("id0")])).toBe(1);
    expect(pool.push([burst("id209")])).toBe(0);
  });

  it("uses real timers by default", () => {
    vi.useFakeTimers();
    const hide = vi.fn();
    const pool = new BurstPool(() => ({ show: vi.fn(), hide }));
    pool.push([burst("a")]);
    expect(pool.active).toBe(1);
    vi.advanceTimersByTime(BURST_DURATION_MS);
    expect(pool.active).toBe(0);
    vi.useRealTimers();
  });
});

describe("burst animation", () => {
  it("rises while fading, or only fades with reduced motion", () => {
    const moving = burstKeyframes(false);
    expect(moving.at(-1)?.transform).toBe(`translateY(-${BURST_RISE_PX}px) scale(1)`);
    const still = burstKeyframes(true);
    expect(still.every((k) => k.transform === undefined)).toBe(true);
    expect(still[0].opacity).toBe(0);
    expect(still.at(-1)?.opacity).toBe(0);
  });

  it("colours gains green and losses red", () => {
    expect(burstStyle("gain").color).not.toBe(burstStyle("loss").color);
    expect(burstStyle("gain").pointerEvents).toBe("none");
  });
});

/** Minimal DOM element stand-in. */
function fakeElement(withAnimate: boolean) {
  const element = {
    style: {} as Record<string, string>,
    textContent: "",
    children: [] as unknown[],
    appendChild(child: unknown) {
      element.children.push(child);
    },
    animations: [] as Array<{ keyframes: Keyframe[]; cancelled: boolean }>,
    animate: withAnimate
      ? (keyframes: Keyframe[]) => {
          const animation = {
            keyframes,
            cancelled: false,
            cancel() {
              animation.cancelled = true;
            },
          };
          element.animations.push(animation);
          return animation;
        }
      : undefined,
  };
  return element;
}

describe("createMarkerSlot()", () => {
  const setup = (withAnimate: boolean, reduced = false) => {
    const created: ReturnType<typeof fakeElement>[] = [];
    const doc = {
      createElement: () => {
        const el = fakeElement(withAnimate);
        created.push(el);
        return el;
      },
    } as unknown as Document;
    const calls: string[] = [];
    const marker: MarkerLike = {
      setLngLat: (lngLat) => {
        calls.push(`at ${lngLat.join(",")}`);
        return marker;
      },
      addTo: () => {
        calls.push("add");
        return marker;
      },
      remove: () => {
        calls.push("remove");
        return marker;
      },
    };
    let wrapper: unknown;
    const slot = createMarkerSlot(
      "map",
      (element) => {
        wrapper = element;
        return marker;
      },
      () => reduced,
      doc,
    );
    return { slot, created, calls, wrapper: () => wrapper };
  };

  it("places the label at the burst and animates the inner element", () => {
    const { slot, created, calls, wrapper } = setup(true);
    const [outer, label] = created;
    expect(wrapper()).toBe(outer);
    slot.show(burst("12K", "gain"));
    expect(label.textContent).toBe("+$12K");
    expect(calls).toEqual(["at 1,2", "add"]);
    expect(label.animations[0].keyframes).toEqual(burstKeyframes(false));
    slot.hide();
    expect(label.animations[0].cancelled).toBe(true);
    expect(calls.at(-1)).toBe("remove");
  });

  it("uses the reduced-motion keyframes when asked", () => {
    const { slot, created } = setup(true, true);
    slot.show(burst("a"));
    expect(created[1].animations[0].keyframes).toEqual(burstKeyframes(true));
  });

  it("shows the label statically without the Web Animations API", () => {
    const { slot, created } = setup(false);
    slot.show(burst("a", "loss"));
    expect(created[1].style.opacity).toBe("1");
    slot.hide();
  });
});

describe("prefersReducedMotion()", () => {
  it("reads the media query, and is false without a window", () => {
    expect(prefersReducedMotion()).toBe(false);
    vi.stubGlobal("window", { matchMedia: () => ({ matches: true }) });
    expect(prefersReducedMotion()).toBe(true);
    vi.unstubAllGlobals();
  });
});
