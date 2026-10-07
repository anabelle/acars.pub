/**
 * The map clock (S54): one cadence for everything that animates the globe.
 * Flight positions and the route-flow dash are written in the same task, so
 * MapLibre folds them into a single redraw, and a write that would change
 * nothing (an empty fleet staying empty, the same dash step) is skipped, so
 * an idle map stops redrawing at all.
 */

/** Milliseconds between clock ticks (5 a second still reads as smooth motion at map scale). */
export const MAP_CLOCK_MS = 200;

export interface MapClockState {
  /** Features last uploaded to the player's and rivals' flight sources. */
  flights: number;
  globalFlights: number;
  /** The flow dash last applied (its key), or null. */
  flowKey: string | null;
}

export interface MapClockInput {
  flights: number;
  globalFlights: number;
  /** The dash to show, or null when the flow is off (no routes, reduced motion). */
  flowDash: readonly number[] | null;
}

export interface MapClockPlan {
  uploadFlights: boolean;
  uploadGlobalFlights: boolean;
  /** The dash to apply this tick, or null to leave the layer as it is. */
  flowDash: readonly number[] | null;
  next: MapClockState;
}

export const initialMapClockState = (): MapClockState => ({
  flights: 0,
  globalFlights: 0,
  flowKey: null,
});

/**
 * What to write this tick. A flight source is uploaded while it has
 * aircraft, plus once more when it empties (to clear the last positions);
 * the flow dash only when its step changed. Pure.
 */
export function planMapClockTick(state: MapClockState, input: MapClockInput): MapClockPlan {
  const flowKey = input.flowDash ? input.flowDash.join(",") : null;
  const flowDash = input.flowDash && flowKey !== state.flowKey ? input.flowDash : null;
  return {
    uploadFlights: input.flights > 0 || state.flights > 0,
    uploadGlobalFlights: input.globalFlights > 0 || state.globalFlights > 0,
    flowDash,
    next: {
      flights: input.flights,
      globalFlights: input.globalFlights,
      // Keep the last applied dash while the flow is off, so it resumes cleanly.
      flowKey: flowKey ?? state.flowKey,
    },
  };
}

/** Whether a plan writes anything (and so forces a redraw). */
export const planWrites = (plan: MapClockPlan): boolean =>
  plan.uploadFlights || plan.uploadGlobalFlights || plan.flowDash !== null;
