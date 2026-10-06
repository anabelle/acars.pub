import type { AircraftInstance, Route } from "@acars/core";

/**
 * Ferry-and-assign (S25). A ferry puts the aircraft en route, and en-route
 * aircraft can't be assigned, so the assignment is queued here and published
 * once the aircraft is on the ground at the ferry destination. The queue
 * lives in this browser only (per airline); nothing about it is on Nostr
 * until the assignment itself is signed.
 */
/** Window event fired when the queue changes, so the runner re-reads it. */
export const PENDING_ASSIGNMENTS_EVENT = "acars:pending-assignments";

export interface PendingAssignment {
  aircraftId: string;
  routeId: string;
  ferryTo: string;
}

export interface PendingResolution {
  /** Landed at the ferry destination: assign now. */
  ready: PendingAssignment[];
  /** Still flying there. */
  waiting: PendingAssignment[];
  /** No longer applicable (aircraft or route gone, already assigned, ended up elsewhere). */
  dropped: PendingAssignment[];
}

export function resolvePendingAssignments(
  pending: readonly PendingAssignment[],
  fleet: readonly AircraftInstance[],
  routes: readonly Route[],
): PendingResolution {
  const aircraftById = new Map(fleet.map((aircraft) => [aircraft.id, aircraft]));
  const activeRouteIds = new Set(
    routes.filter((route) => route.status === "active").map((route) => route.id),
  );
  const result: PendingResolution = { ready: [], waiting: [], dropped: [] };
  for (const entry of pending) {
    const aircraft = aircraftById.get(entry.aircraftId);
    if (
      !aircraft ||
      !activeRouteIds.has(entry.routeId) ||
      aircraft.assignedRouteId === entry.routeId
    ) {
      result.dropped.push(entry);
    } else if (aircraft.status === "enroute") {
      result.waiting.push(entry);
    } else if (aircraft.baseAirportIata === entry.ferryTo) {
      result.ready.push(entry);
    } else {
      result.dropped.push(entry);
    }
  }
  return result;
}

/** Adds or replaces the entry for an aircraft (one pending assignment each). */
export function withPending(
  pending: readonly PendingAssignment[],
  entry: PendingAssignment,
): PendingAssignment[] {
  return [...pending.filter((p) => p.aircraftId !== entry.aircraftId), entry];
}

const storageKey = (airlineKey: string) => `acars_pending_assignments:${airlineKey}`;

function isPendingAssignment(value: unknown): value is PendingAssignment {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.aircraftId === "string" &&
    typeof v.routeId === "string" &&
    typeof v.ferryTo === "string"
  );
}

export function loadPendingAssignments(airlineKey: string): PendingAssignment[] {
  try {
    const raw = window.localStorage.getItem(storageKey(airlineKey));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isPendingAssignment) : [];
  } catch {
    return [];
  }
}

export function savePendingAssignments(airlineKey: string, pending: readonly PendingAssignment[]) {
  try {
    if (pending.length === 0) window.localStorage.removeItem(storageKey(airlineKey));
    else window.localStorage.setItem(storageKey(airlineKey), JSON.stringify(pending));
  } catch {
    // Storage unavailable (private mode, quota): the queue lasts this session only.
  }
}
