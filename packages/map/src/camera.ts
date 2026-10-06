import { haversineDistance } from "@acars/core";
import { globeFitZoom } from "./layers/globeView.js";

export interface FlightPlan {
  /** Milliseconds; longer trips take longer so they read as a journey. */
  duration: number;
  /**
   * Cap on how far the flight path zooms out. Long trips arc out naturally;
   * capping at the whole-globe view makes them rise to space and no further.
   */
  minZoom?: number;
}

/** Trips longer than this pull back far enough to see the curve of the planet. */
export const LONG_HOP_KM = 2500;

/**
 * Plans a camera flight between two points: duration from the great-circle
 * distance (1.2–4 s) and, for long hops, a path that rises to (and stops at)
 * the whole-globe view before descending: the "from space to your hub" moment.
 * Pure.
 */
export function planCameraFlight(
  from: { lng: number; lat: number },
  to: { lng: number; lat: number },
  zooms: { current: number; target: number },
  viewport: { width: number; height: number },
): FlightPlan {
  const km = haversineDistance(from.lat, from.lng, to.lat, to.lng);
  const duration = Math.round(Math.min(4000, Math.max(1200, 1000 + km * 0.3)));
  if (km < LONG_HOP_KM) return { duration };
  const space = globeFitZoom(viewport.width, viewport.height);
  return { duration, minZoom: Math.min(zooms.current, zooms.target, space) };
}
