import type { TimelineEvent } from "@acars/core";
import { useAirlineStore, useEngineStore } from "@acars/store";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SoundBridge } from "./SoundBridge";
import { SoundSettingsCard } from "./SoundSettingsCard";
import { getSoundEnabled, resetSoundCache, setSoundEnabled } from "./soundSettings";
import { deliveryFanfare, landingChime, soundFor } from "./tones";

const initialAirline = useAirlineStore.getState();
const initialEngine = useEngineStore.getState();

const event = (type: TimelineEvent["type"], id: string, loadFactor?: number): TimelineEvent => ({
  id,
  tick: 1,
  timestamp: 1,
  type,
  description: "",
  details: loadFactor === undefined ? undefined : { loadFactor },
});

function addEvent(e: TimelineEvent, ticks = 3) {
  act(() => {
    useAirlineStore.setState(
      (state) =>
        ({
          timeline: [e, ...state.timeline],
          airline: {
            ...(state.airline as object),
            lastTick: (state.airline?.lastTick ?? 0) + ticks,
          },
        }) as never,
    );
  });
}

beforeEach(() => {
  localStorage.clear();
  resetSoundCache();
  useAirlineStore.setState({ timeline: [], airline: { lastTick: 1000 } } as never);
  useEngineStore.setState({ catchupProgress: null } as never);
});

afterEach(() => {
  cleanup();
  useAirlineStore.setState(initialAirline, true);
  useEngineStore.setState(initialEngine, true);
  resetSoundCache();
  vi.useRealTimers();
});

describe("tones", () => {
  it("chimes higher for a fuller plane and prefers a delivery's fanfare", () => {
    expect(landingChime(1)[0].freq).toBeGreaterThan(landingChime(0.2)[0].freq);
    expect(landingChime(5)[0].freq).toBe(landingChime(1)[0].freq);
    expect(soundFor([event("landing", "l", 0.9), event("delivery", "d")])).toEqual(
      deliveryFanfare(),
    );
    expect(soundFor([event("landing", "l", 0.9)])).toEqual(landingChime(0.9));
    expect(soundFor([event("maintenance", "m")])).toBeNull();
  });
});

describe("sound settings", () => {
  it("is off by default and remembers the switch", () => {
    expect(getSoundEnabled()).toBe(false);
    setSoundEnabled(true);
    resetSoundCache();
    expect(getSoundEnabled()).toBe(true);
  });

  it("the card switches it on with a sample chime, and off silently", () => {
    const play = vi.fn();
    render(<SoundSettingsCard play={play} />);
    const toggle = screen.getByTestId("sound-toggle");
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(play).toHaveBeenCalledTimes(1);
    fireEvent.click(toggle);
    expect(getSoundEnabled()).toBe(false);
    expect(play).toHaveBeenCalledTimes(1);
  });
});

describe("SoundBridge", () => {
  it("stays silent while sound is off", () => {
    const play = vi.fn();
    render(<SoundBridge play={play} />);
    addEvent(event("landing", "l1", 0.9));
    expect(play).not.toHaveBeenCalled();
  });

  it("chimes for a live landing, at most once per gap, and never on a catch-up", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-12T02:00:00Z"));
    setSoundEnabled(true);
    const play = vi.fn();
    render(<SoundBridge play={play} />);
    addEvent(event("landing", "l1", 0.9));
    expect(play).toHaveBeenCalledWith(landingChime(0.9));
    addEvent(event("landing", "l2", 0.5));
    expect(play).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date("2026-10-12T02:00:05Z"));
    addEvent(event("delivery", "d1"));
    expect(play).toHaveBeenLastCalledWith(deliveryFanfare());
    vi.setSystemTime(new Date("2026-10-12T02:00:10Z"));
    addEvent(event("landing", "l3", 0.9), 12_000);
    expect(play).toHaveBeenCalledTimes(2);
  });
});
