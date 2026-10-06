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
  const action =
    typeof content === "object" && content !== null
      ? (content as { action?: unknown }).action
      : undefined;
  if (typeof action !== "string" || !action) return null;
  return { pubkey: event.pubkey, createdAt: event.created_at, type: action };
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
