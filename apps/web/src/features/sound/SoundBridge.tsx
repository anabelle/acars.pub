import { useAirlineStore, useEngineStore } from "@acars/store";
import { useEffect } from "react";
import { subscribeToNewTimelineEvents } from "@/shared/lib/timelineEvents";
import { playNotes } from "./player";
import { getSoundEnabled } from "./soundSettings";
import { soundFor } from "./tones";

/** At most one sound this often, however many planes land together. */
export const MIN_GAP_MS = 2500;

/**
 * Sound for live events (S76): a chime when a plane lands, a fanfare on
 * delivery day. Only when switched on and the tab is visible; catch-ups
 * after an absence stay silent (the shared timeline subscription skips them).
 */
export function SoundBridge({ play = playNotes }: { play?: typeof playNotes }) {
  useEffect(() => {
    let last = Number.NEGATIVE_INFINITY;
    return subscribeToNewTimelineEvents(
      { airline: useAirlineStore, engine: useEngineStore },
      5,
      (events) => {
        if (!getSoundEnabled()) return;
        if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
        const now = Date.now();
        if (now - last < MIN_GAP_MS) return;
        const notes = soundFor(events);
        if (!notes) return;
        last = now;
        play(notes);
      },
    );
  }, [play]);
  return null;
}
