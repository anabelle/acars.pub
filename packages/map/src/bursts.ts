// =============================================================================
// Floating money labels on the map (S43): "+$12.3K" rising from an airport
// when one of your flights lands there.
//
// A fixed pool of labels is reused: a burst takes a free slot or recycles the
// oldest, so a wave of landings never creates more than BURST_POOL_SIZE
// elements. The marker (position on the globe) and the animation are
// injected so the pool logic stays testable without MapLibre or a DOM.
// =============================================================================

export interface MapBurst {
  /** Stable id (the landing event's), so the same landing never shows twice. */
  id: string;
  longitude: number;
  latitude: number;
  /** Already formatted, e.g. "+$12.3K". */
  text: string;
  tone: "gain" | "loss";
}

/** Labels on screen at once, at most. */
export const BURST_POOL_SIZE = 6;
/** How long one label lives. */
export const BURST_DURATION_MS = 1800;
/** How far (px) a label rises while it fades (none with reduced motion). */
export const BURST_RISE_PX = 28;

/** What the pool needs from a label: MapLibre's Marker satisfies it. */
export interface BurstSlot {
  show(burst: MapBurst): void;
  hide(): void;
}

interface Timers {
  set: (callback: () => void, ms: number) => unknown;
  clear: (handle: unknown) => void;
}

const defaultTimers: Timers = {
  set: (callback, ms) => setTimeout(callback, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export class BurstPool {
  private readonly slots: Array<{ slot: BurstSlot; startedAt: number; timer: unknown }> = [];
  private readonly seen = new Set<string>();
  private readonly seenOrder: string[] = [];

  private readonly createSlot: () => BurstSlot;
  private readonly now: () => number;
  private readonly timers: Timers;
  private readonly size: number;

  constructor(
    createSlot: () => BurstSlot,
    now: () => number = () => Date.now(),
    timers: Timers = defaultTimers,
    size = BURST_POOL_SIZE,
  ) {
    this.createSlot = createSlot;
    this.now = now;
    this.timers = timers;
    this.size = size;
  }

  /** Number of labels currently showing. */
  get active(): number {
    return this.slots.filter((s) => s.timer !== null).length;
  }

  /** Shows each burst not shown before; returns how many were shown. */
  push(bursts: readonly MapBurst[]): number {
    let shown = 0;
    for (const burst of bursts) {
      if (this.seen.has(burst.id)) continue;
      this.remember(burst.id);
      this.show(burst);
      shown++;
    }
    return shown;
  }

  /** Hides every label (e.g. when the map goes away). */
  clear(): void {
    for (const entry of this.slots) {
      if (entry.timer !== null) this.timers.clear(entry.timer);
      entry.timer = null;
      entry.slot.hide();
    }
  }

  private show(burst: MapBurst) {
    const entry = this.takeSlot();
    if (entry.timer !== null) this.timers.clear(entry.timer);
    entry.slot.hide();
    entry.slot.show(burst);
    entry.startedAt = this.now();
    entry.timer = this.timers.set(() => {
      entry.timer = null;
      entry.slot.hide();
    }, BURST_DURATION_MS);
  }

  /** A free slot, a new one while under the cap, else the oldest showing. */
  private takeSlot() {
    const free = this.slots.find((s) => s.timer === null);
    if (free) return free;
    if (this.slots.length < this.size) {
      const entry = { slot: this.createSlot(), startedAt: 0, timer: null as unknown };
      this.slots.push(entry);
      return entry;
    }
    return this.slots.reduce((oldest, s) => (s.startedAt < oldest.startedAt ? s : oldest));
  }

  /** Remembers ids (bounded) so re-sent bursts are ignored. */
  private remember(id: string) {
    this.seen.add(id);
    this.seenOrder.push(id);
    if (this.seenOrder.length > 200) {
      const dropped = this.seenOrder.shift();
      if (dropped !== undefined) this.seen.delete(dropped);
    }
  }
}

/** Keyframes for a label: rise and fade, or only fade with reduced motion. */
export function burstKeyframes(reducedMotion: boolean): Keyframe[] {
  if (reducedMotion) {
    return [
      { opacity: 0 },
      { opacity: 1, offset: 0.15 },
      { opacity: 1, offset: 0.7 },
      { opacity: 0 },
    ];
  }
  return [
    { opacity: 0, transform: "translateY(6px) scale(0.9)" },
    { opacity: 1, transform: "translateY(0) scale(1)", offset: 0.15 },
    { opacity: 1, transform: `translateY(-${BURST_RISE_PX * 0.6}px) scale(1)`, offset: 0.7 },
    { opacity: 0, transform: `translateY(-${BURST_RISE_PX}px) scale(1)` },
  ];
}

/** Inline styles for a label element (the map package ships no CSS). */
export function burstStyle(tone: MapBurst["tone"]): Partial<CSSStyleDeclaration> {
  return {
    pointerEvents: "none",
    font: "700 13px/1 ui-sans-serif, system-ui, sans-serif",
    letterSpacing: "0.02em",
    padding: "3px 7px",
    borderRadius: "999px",
    whiteSpace: "nowrap",
    color: tone === "gain" ? "#bbf7d0" : "#fecaca",
    background: tone === "gain" ? "rgba(6, 78, 59, 0.82)" : "rgba(127, 29, 29, 0.82)",
    border: `1px solid ${tone === "gain" ? "rgba(74, 222, 128, 0.6)" : "rgba(248, 113, 113, 0.6)"}`,
    boxShadow: "0 4px 14px rgba(0, 0, 0, 0.35)",
    opacity: "0",
  };
}

/** The parts of a MapLibre Marker a label slot uses. */
export interface MarkerLike {
  setLngLat(lngLat: [number, number]): MarkerLike;
  addTo(map: unknown): MarkerLike;
  remove(): MarkerLike;
}

/**
 * A pooled label slot drawn as a MapLibre marker. The marker element is a
 * wrapper (MapLibre positions it with `transform`); the animated label sits
 * inside it so the two transforms don't fight.
 */
export function createMarkerSlot(
  map: unknown,
  createMarker: (element: HTMLElement) => MarkerLike,
  reducedMotion: () => boolean,
  doc: Document = document,
): BurstSlot {
  const wrapper = doc.createElement("div");
  wrapper.style.pointerEvents = "none";
  const label = doc.createElement("div");
  wrapper.appendChild(label);
  const marker = createMarker(wrapper);
  let animation: Animation | undefined;
  return {
    show(burst) {
      label.textContent = burst.text;
      Object.assign(label.style, burstStyle(burst.tone));
      marker.setLngLat([burst.longitude, burst.latitude]).addTo(map);
      animation = label.animate?.(burstKeyframes(reducedMotion()), {
        duration: BURST_DURATION_MS,
        easing: "ease-out",
        fill: "forwards",
      });
      // Without the Web Animations API, just show the label for its lifetime.
      if (!animation) label.style.opacity = "1";
    },
    hide() {
      animation?.cancel();
      animation = undefined;
      marker.remove();
    },
  };
}

/** True when the viewer asked the system for reduced motion. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
