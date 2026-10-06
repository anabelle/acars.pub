/**
 * Funnel metrics from public game events (S04). Pure, dependency-free
 * functions over raw relay events, so `scripts/funnel.ts` can run them under
 * plain Node and the package tests cover them. Counts only: nothing here
 * keeps or reports pubkeys beyond grouping events in memory.
 */

/** A raw Nostr event as relays return it. */
export interface RawNostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
}

export interface FunnelEvent {
  pubkey: string;
  /** Unix seconds. */
  createdAt: number;
  /** Game action type, or "CHECKPOINT" for an airline's saved state. */
  type: string;
  /** ROUTE_OPEN / ROUTE_ASSIGN_AIRCRAFT: the route involved. */
  routeId?: string;
  /** ROUTE_OPEN: great-circle distance, for the first-landing estimate. */
  distanceKm?: number;
}

export const FUNNEL_ACTION_KIND = 30078;
/** Must equal `WORLD_ID` in schema.ts (a test checks it). */
export const FUNNEL_WORLD_ID = "v6-beta";
export const CHECKPOINT_TYPE = "CHECKPOINT";

const DAY_SEC = 24 * 60 * 60;

/** UTC calendar day (YYYY-MM-DD) of a unix-seconds timestamp. */
export function utcDay(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

/**
 * Reads one relay event as a funnel event for `worldId`: an action
 * (`airtr:world:<id>:action:*`, type from its content) or an airline
 * checkpoint (`airtr:world:<id>:checkpoint`). Anything else is null.
 */
export function parseFunnelEvent(event: RawNostrEvent, worldId: string): FunnelEvent | null {
  if (event.kind !== FUNNEL_ACTION_KIND) return null;
  const dTag = event.tags.find((tag) => tag[0] === "d")?.[1];
  if (!dTag) return null;
  const base = `airtr:world:${worldId}:`;
  if (dTag === `${base}checkpoint`) {
    return { pubkey: event.pubkey, createdAt: event.created_at, type: CHECKPOINT_TYPE };
  }
  if (!dTag.startsWith(`${base}action:`)) return null;
  let content: unknown;
  try {
    content = JSON.parse(event.content);
  } catch {
    return null;
  }
  if (typeof content !== "object" || content === null) return null;
  const { action, payload } = content as { action?: unknown; payload?: unknown };
  if (typeof action !== "string" || !action) return null;
  const parsed: FunnelEvent = { pubkey: event.pubkey, createdAt: event.created_at, type: action };
  if (typeof payload === "object" && payload !== null) {
    const { routeId, distanceKm } = payload as { routeId?: unknown; distanceKm?: unknown };
    if (typeof routeId === "string" && routeId) parsed.routeId = routeId;
    if (typeof distanceKm === "number" && Number.isFinite(distanceKm) && distanceKm > 0) {
      parsed.distanceKm = distanceKm;
    }
  }
  return parsed;
}

/** Parses and de-duplicates (by event id) events from several relays. */
export function collectFunnelEvents(
  events: Iterable<RawNostrEvent>,
  worldId: string,
): FunnelEvent[] {
  const seen = new Set<string>();
  const result: FunnelEvent[] = [];
  for (const event of events) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    const parsed = parseFunnelEvent(event, worldId);
    if (parsed) result.push(parsed);
  }
  return result.sort((a, b) => a.createdAt - b.createdAt);
}

export interface DailyCounts {
  /** Every UTC day in the range, oldest first, even days with no events. */
  days: string[];
  /** Event types seen, alphabetical. */
  types: string[];
  /** counts[day][type]; missing means 0. */
  counts: Record<string, Record<string, number>>;
  /** Distinct pubkeys with any event that day. */
  activeAirlines: Record<string, number>;
}

/** Counts events by UTC day and type within [fromSec, toSec). */
export function countByDayAndType(
  events: readonly FunnelEvent[],
  fromSec: number,
  toSec: number,
): DailyCounts {
  const days: string[] = [];
  for (let t = Math.floor(fromSec / DAY_SEC) * DAY_SEC; t < toSec; t += DAY_SEC) {
    days.push(utcDay(t));
  }
  const counts: DailyCounts["counts"] = {};
  const active: Record<string, Set<string>> = {};
  for (const day of days) {
    counts[day] = {};
    active[day] = new Set();
  }
  const types = new Set<string>();
  for (const event of events) {
    if (event.createdAt < fromSec || event.createdAt >= toSec) continue;
    const day = utcDay(event.createdAt);
    const row = counts[day];
    if (!row) continue;
    row[event.type] = (row[event.type] ?? 0) + 1;
    types.add(event.type);
    active[day].add(event.pubkey);
  }
  const activeAirlines: Record<string, number> = {};
  for (const day of days) activeAirlines[day] = active[day].size;
  return { days, types: [...types].sort(), counts, activeAirlines };
}

/** Plain-text table of daily counts, for the CLI. */
export function formatDailyCounts({ days, types, counts, activeAirlines }: DailyCounts): string {
  const header = ["day", "active", ...types];
  const rows = days.map((day) => [
    day,
    String(activeAirlines[day]),
    ...types.map((type) => String(counts[day][type] ?? 0)),
  ]);
  const widths = header.map((cell, i) =>
    Math.max(cell.length, ...rows.map((row) => row[i].length)),
  );
  const line = (cells: string[]) => cells.map((cell, i) => cell.padStart(widths[i])).join("  ");
  return [line(header), ...rows.map(line)].join("\n");
}

// ============================================================
// Journeys, funnel and cohorts (S04.2)
// ============================================================

/**
 * Conservative block speed for the first-landing estimate (turboprop cruise
 * plus taxi): first landing ≈ first assignment + distance ÷ this.
 */
export const FIRST_LANDING_BLOCK_KMH = 500;
/** Used when the assigned route's distance is unknown (opened out of range). */
export const FIRST_LANDING_FALLBACK_SEC = 2 * 60 * 60;

export interface AirlineJourney {
  createdAt: number;
  firstRouteAt: number | null;
  firstAssignAt: number | null;
  /** Estimated: first assignment + flight time on that route. */
  firstLandingAt: number | null;
  /** Latest signed action or checkpoint. */
  lastSeenAt: number;
}

/**
 * One journey per airline created in the events (first `AIRLINE_CREATE` per
 * pubkey). Airlines whose genesis is outside the events are left out.
 */
export function buildJourneys(events: readonly FunnelEvent[]): AirlineJourney[] {
  const byPubkey = new Map<string, FunnelEvent[]>();
  for (const event of events) {
    const list = byPubkey.get(event.pubkey);
    if (list) list.push(event);
    else byPubkey.set(event.pubkey, [event]);
  }
  const journeys: AirlineJourney[] = [];
  for (const list of byPubkey.values()) {
    list.sort((a, b) => a.createdAt - b.createdAt);
    const create = list.find((event) => event.type === "AIRLINE_CREATE");
    if (!create) continue;
    const after = list.filter((event) => event.createdAt >= create.createdAt);
    const distances = new Map<string, number>();
    let firstRouteAt: number | null = null;
    let firstAssign: FunnelEvent | null = null;
    for (const event of after) {
      if (event.type === "ROUTE_OPEN") {
        firstRouteAt ??= event.createdAt;
        if (event.routeId && event.distanceKm) distances.set(event.routeId, event.distanceKm);
      }
      if (event.type === "ROUTE_ASSIGN_AIRCRAFT" && !firstAssign) firstAssign = event;
    }
    let firstLandingAt: number | null = null;
    if (firstAssign) {
      const km = firstAssign.routeId ? distances.get(firstAssign.routeId) : undefined;
      const flightSec = km
        ? Math.round((km / FIRST_LANDING_BLOCK_KMH) * 3600)
        : FIRST_LANDING_FALLBACK_SEC;
      firstLandingAt = firstAssign.createdAt + flightSec;
    }
    journeys.push({
      createdAt: create.createdAt,
      firstRouteAt,
      firstAssignAt: firstAssign?.createdAt ?? null,
      firstLandingAt,
      lastSeenAt: after[after.length - 1].createdAt,
    });
  }
  return journeys.sort((a, b) => a.createdAt - b.createdAt);
}

export const RETENTION_DAYS = [1, 7, 30] as const;
export type RetentionDay = (typeof RETENTION_DAYS)[number];

export interface FunnelSummary {
  created: number;
  openedRoute: number;
  assigned: number;
  /** First landing estimated to have happened by `nowSec`. */
  landed: number;
  /** For each Dn: airlines old enough to measure, and how many were seen on or after day n. */
  retention: Record<RetentionDay, { eligible: number; retained: number }>;
}

function retentionOf(journeys: readonly AirlineJourney[], nowSec: number) {
  const retention = {} as FunnelSummary["retention"];
  for (const day of RETENTION_DAYS) {
    const eligible = journeys.filter((j) => j.createdAt + day * DAY_SEC <= nowSec);
    retention[day] = {
      eligible: eligible.length,
      retained: eligible.filter((j) => j.lastSeenAt >= j.createdAt + day * DAY_SEC).length,
    };
  }
  return retention;
}

export function summarizeFunnel(
  journeys: readonly AirlineJourney[],
  nowSec: number,
): FunnelSummary {
  return {
    created: journeys.length,
    openedRoute: journeys.filter((j) => j.firstRouteAt !== null).length,
    assigned: journeys.filter((j) => j.firstAssignAt !== null).length,
    landed: journeys.filter((j) => j.firstLandingAt !== null && j.firstLandingAt <= nowSec).length,
    retention: retentionOf(journeys, nowSec),
  };
}

/** Nearest-rank percentile (0–100) of `values`, or null when empty. */
export function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.min(sorted.length, Math.max(1, Math.ceil((p / 100) * sorted.length)));
  return sorted[rank - 1];
}

/** Seconds from airline creation to first aircraft assignment: median and p75. */
export function timeToFirstAssignment(journeys: readonly AirlineJourney[]) {
  const durations = journeys
    .filter((j) => j.firstAssignAt !== null)
    .map((j) => (j.firstAssignAt as number) - j.createdAt);
  return {
    count: durations.length,
    median: percentile(durations, 50),
    p75: percentile(durations, 75),
  };
}

/** Monday (UTC) of the week containing a timestamp, as YYYY-MM-DD. */
export function utcWeekStart(unixSeconds: number): string {
  const day = Math.floor(unixSeconds / DAY_SEC);
  // 1970-01-01 was a Thursday: (day + 3) % 7 is days since Monday.
  return utcDay((day - ((day + 3) % 7)) * DAY_SEC);
}

export interface WeeklyCohort extends FunnelSummary {
  week: string;
}

/** Funnel and retention per creation week, oldest first. */
export function weeklyCohorts(journeys: readonly AirlineJourney[], nowSec: number): WeeklyCohort[] {
  const byWeek = new Map<string, AirlineJourney[]>();
  for (const journey of journeys) {
    const week = utcWeekStart(journey.createdAt);
    const list = byWeek.get(week);
    if (list) list.push(journey);
    else byWeek.set(week, [journey]);
  }
  return [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, list]) => ({ week, ...summarizeFunnel(list, nowSec) }));
}

// ============================================================
// Markdown report (S04.3)
// ============================================================

export interface RelayReadResult {
  url: string;
  /** Events read, or null when the relay could not be read. */
  events: number | null;
}

export interface FunnelReportInput {
  worldId: string;
  sinceSec: number;
  untilSec: number;
  relays: readonly RelayReadResult[];
  events: readonly FunnelEvent[];
}

const pctOf = (n: number, of: number) => (of > 0 ? `${Math.round((n / of) * 100)}%` : "—");
const mdRow = (cells: Array<string | number>) => `| ${cells.join(" | ")} |`;
const mdHeader = (cells: string[]) =>
  [mdRow(cells), mdRow(cells.map((_, i) => (i === 0 ? "---" : "--:")))].join("\n");
const minutesOf = (sec: number | null) => (sec === null ? "—" : `${Math.round(sec / 60)} min`);

/** The committed metrics report: counts only, never pubkeys. */
export function formatFunnelReport(input: FunnelReportInput): string {
  const { worldId, sinceSec, untilSec, relays, events } = input;
  const daily = countByDayAndType(events, sinceSec, untilSec);
  const journeys = buildJourneys(events);
  const summary = summarizeFunnel(journeys, untilSec);
  const ttfa = timeToFirstAssignment(journeys);
  const readable = relays.filter((relay) => relay.events !== null);

  const lines = [
    `# ACARS funnel — ${utcDay(untilSec)}`,
    "",
    `Generated by \`pnpm funnel --report\` from public game events (kind ${FUNNEL_ACTION_KIND}, world \`${worldId}\`), ${utcDay(sinceSec)} to ${utcDay(untilSec)} UTC. Counts only; no pubkeys.`,
    "",
    `Relays read: ${readable.length} of ${relays.length}${
      relays.length > readable.length
        ? ` (unreachable: ${relays
            .filter((relay) => relay.events === null)
            .map((relay) => relay.url)
            .join(", ")})`
        : ""
    }. Game events: ${events.length}.`,
    "",
    "## Funnel",
    "",
    mdHeader(["Stage", "Airlines", "Of created"]),
    mdRow(["Created", summary.created, pctOf(summary.created, summary.created)]),
    mdRow(["Opened a route", summary.openedRoute, pctOf(summary.openedRoute, summary.created)]),
    mdRow(["Assigned an aircraft", summary.assigned, pctOf(summary.assigned, summary.created)]),
    mdRow(["First landing (estimated)", summary.landed, pctOf(summary.landed, summary.created)]),
    "",
    mdHeader(["Retention", "Eligible", "Retained", "Rate"]),
    ...RETENTION_DAYS.map((day) => {
      const { eligible, retained } = summary.retention[day];
      return mdRow([`D${day}`, eligible, retained, pctOf(retained, eligible)]);
    }),
    "",
    `Time to first assignment (n=${ttfa.count}): median ${minutesOf(ttfa.median)}, p75 ${minutesOf(ttfa.p75)}.`,
    "",
    "## Weekly cohorts",
    "",
    mdHeader(["Week (Mon)", "Created", "Route", "Assigned", "D1", "D7", "D30"]),
    ...weeklyCohorts(journeys, untilSec).map((cohort) =>
      mdRow([
        cohort.week,
        cohort.created,
        pctOf(cohort.openedRoute, cohort.created),
        pctOf(cohort.assigned, cohort.created),
        ...RETENTION_DAYS.map((day) =>
          pctOf(cohort.retention[day].retained, cohort.retention[day].eligible),
        ),
      ]),
    ),
    "",
    "## Daily events",
    "",
    mdHeader(["Day", "Active airlines", ...daily.types]),
    ...daily.days.map((day) =>
      mdRow([
        day,
        daily.activeAirlines[day],
        ...daily.types.map((type) => daily.counts[day][type] ?? 0),
      ]),
    ),
    "",
    "_Notes: retention counts an airline as retained on Dn if it signed any action or checkpoint on or after day n; a cohort counts only once it is n days old. Regular actions expire from relays after 14 days, so D30 relies on checkpoints. First landing = first assignment + route distance ÷ 500 km/h (2 h if unknown)._",
    "",
  ];
  return lines.join("\n");
}
