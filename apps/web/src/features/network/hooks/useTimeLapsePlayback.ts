import type { AircraftInstance } from "@acars/core";
import { type RefObject, useEffect, useRef, useState } from "react";
import { stopTimeLapse } from "@/features/airline/lib/timeLapseState";
import {
  legsInAir,
  replayFleet,
  type TimeLapse,
  timeLapseTick,
} from "@/features/airline/utils/timeLapse";

/** How often the planes in the air are re-checked: the map clock's cadence (S54). */
const PLANE_CHECK_MS = 200;
/** The replay holds its last frame this long before handing the map back. */
const END_HOLD_MS = 2_000;

export interface TimeLapsePlayback {
  /** The replayed flights in the air right now. */
  fleet: AircraftInstance[];
  /** Replay clock for the globe, in the engine clock's shape. */
  clock: RefObject<{ tick: number; tickProgress: number }>;
  /** Real milliseconds since the replay started (read by the replay bar). */
  elapsed: RefObject<number>;
}

/**
 * Plays a time-lapse on the globe (S55.3): a clock running at the replay's
 * speed, and the legs in the air at that clock as stand-in aircraft. The
 * clock advances every frame through a ref (no re-render); the plane list
 * changes only when a leg departs or lands, checked at the map's cadence.
 */
export function useTimeLapsePlayback(
  lapse: TimeLapse | null,
  fleet: AircraftInstance[],
): TimeLapsePlayback | null {
  const clock = useRef({ tick: 0, tickProgress: 0 });
  const elapsed = useRef(0);
  // The store's fleet changes every tick: read it through a ref so the
  // replay doesn't restart.
  const fleetRef = useRef(fleet);
  useEffect(() => {
    fleetRef.current = fleet;
  }, [fleet]);
  const [planes, setPlanes] = useState<{ lapse: TimeLapse | null; fleet: AircraftInstance[] }>({
    lapse: null,
    fleet: [],
  });

  useEffect(() => {
    if (!lapse) return;
    const fleetById = new Map(fleetRef.current.map((aircraft) => [aircraft.id, aircraft]));
    const fallback = fleetRef.current[0];
    let started: number | null = null;
    let lastCheck = Number.NEGATIVE_INFINITY;
    let key: string | null = null;
    let frame = 0;
    const step = (now: number) => {
      started ??= now;
      const ms = now - started;
      elapsed.current = ms;
      const tick = timeLapseTick(lapse, ms);
      const whole = Math.floor(tick);
      clock.current = { tick: whole, tickProgress: tick - whole };
      if (now - lastCheck >= PLANE_CHECK_MS) {
        lastCheck = now;
        const active = legsInAir(lapse, tick);
        const nextKey = active.join(",");
        if (nextKey !== key) {
          key = nextKey;
          setPlanes({ lapse, fleet: replayFleet(lapse, active, fleetById, fallback) });
        }
      }
      if (ms >= lapse.durationMs + END_HOLD_MS) {
        stopTimeLapse();
        return;
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [lapse]);

  if (!lapse) return null;
  return { fleet: planes.lapse === lapse ? planes.fleet : [], clock, elapsed };
}
