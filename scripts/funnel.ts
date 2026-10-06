#!/usr/bin/env node
/**
 * funnel.ts — funnel metrics from public ACARS game events (S04).
 *
 * Reads action and checkpoint events (kind 30078) for the current world from
 * Nostr relays over a date range and prints counts. Counts only: no pubkeys
 * are printed or written. No keys needed.
 *
 * Usage:
 *   node --experimental-strip-types scripts/funnel.ts [options]
 *
 * Options:
 *   --days <n>      Days back from now to read (default: 7)
 *   --relay <url>   Relay to read (repeatable; default: the game's relay list)
 *   --world <id>    World id (default: the game's current world)
 *   --max-pages <n> Pages of 500 events per relay (default: 40)
 */

import {
  buildJourneys,
  collectFunnelEvents,
  countByDayAndType,
  FUNNEL_ACTION_KIND,
  FUNNEL_WORLD_ID,
  formatDailyCounts,
  type RawNostrEvent,
  summarizeFunnel,
  timeToFirstAssignment,
  weeklyCohorts,
} from "../packages/nostr/src/funnel.ts";

const DEFAULT_RELAYS = [
  "wss://nostr.acars.pub",
  "wss://relay.damus.io",
  "wss://relay.primal.net",
  "wss://nos.lol",
  "wss://relay.snort.social",
  "wss://offchain.pub",
  "wss://relay.nostr.net",
  "wss://relay.nos.social",
  "wss://nostr.land",
];
const PAGE_LIMIT = 500;
const DAY_SEC = 86_400;

function parseArgs(argv: string[]) {
  const options = { days: 7, relays: [] as string[], world: FUNNEL_WORLD_ID, maxPages: 40 };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i + 1];
    switch (argv[i]) {
      case "--days":
        options.days = Math.max(1, Number(value) || 7);
        i += 1;
        break;
      case "--relay":
        options.relays.push(value);
        i += 1;
        break;
      case "--world":
        options.world = value;
        i += 1;
        break;
      case "--max-pages":
        options.maxPages = Math.max(1, Number(value) || 40);
        i += 1;
        break;
      default:
        throw new Error(`Unknown option ${argv[i]}`);
    }
  }
  if (options.relays.length === 0) options.relays = DEFAULT_RELAYS;
  return options;
}

function connect(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("timed out after 10s"));
    }, 10_000);
    ws.addEventListener("open", () => {
      clearTimeout(timeout);
      resolve(ws);
    });
    ws.addEventListener("error", () => {
      clearTimeout(timeout);
      reject(new Error("connection failed"));
    });
  });
}

/** One REQ page; resolves on EOSE, CLOSED or a 15 s timeout. */
function requestPage(ws: WebSocket, filter: Record<string, unknown>): Promise<RawNostrEvent[]> {
  return new Promise((resolve) => {
    const subId = `funnel-${Math.random().toString(36).slice(2)}`;
    const events: RawNostrEvent[] = [];
    const finish = () => {
      clearTimeout(timeout);
      ws.removeEventListener("message", onMessage);
      ws.send(JSON.stringify(["CLOSE", subId]));
      resolve(events);
    };
    const timeout = setTimeout(finish, 15_000);
    const onMessage = (message: MessageEvent) => {
      let data: unknown;
      try {
        data = JSON.parse(String(message.data));
      } catch {
        return;
      }
      if (!Array.isArray(data) || data[1] !== subId) return;
      if (data[0] === "EVENT" && data[2]) events.push(data[2] as RawNostrEvent);
      else if (data[0] === "EOSE" || data[0] === "CLOSED") finish();
    };
    ws.addEventListener("message", onMessage);
    ws.send(JSON.stringify(["REQ", subId, filter]));
  });
}

/** All kind-30078 events in [since, until) from one relay, paging back by `until`. */
async function readRelay(url: string, since: number, until: number, maxPages: number) {
  const ws = await connect(url);
  const events: RawNostrEvent[] = [];
  let cursor = until;
  try {
    for (let page = 0; page < maxPages; page += 1) {
      const batch = await requestPage(ws, {
        kinds: [FUNNEL_ACTION_KIND],
        since,
        until: cursor,
        limit: PAGE_LIMIT,
      });
      events.push(...batch);
      if (batch.length < PAGE_LIMIT) break;
      cursor = Math.min(...batch.map((event) => event.created_at)) - 1;
      if (cursor < since) break;
    }
  } finally {
    ws.close();
  }
  return events;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const until = Math.floor(Date.now() / 1000);
  const since = until - options.days * DAY_SEC;
  const raw: RawNostrEvent[] = [];
  for (const url of options.relays) {
    try {
      const events = await readRelay(url, since, until, options.maxPages);
      raw.push(...events);
      console.error(`${url}: ${events.length} events`);
    } catch (error) {
      console.error(`${url}: skipped (${(error as Error).message})`);
    }
  }
  const events = collectFunnelEvents(raw, options.world);
  console.log(`World ${options.world}, last ${options.days} days: ${events.length} game events`);
  console.log(formatDailyCounts(countByDayAndType(events, since, until)));

  const journeys = buildJourneys(events);
  const summary = summarizeFunnel(journeys, until);
  const pct = (n: number, of: number) => (of > 0 ? `${Math.round((n / of) * 100)}%` : "—");
  console.log(`\nFunnel (airlines created in the window: ${summary.created})`);
  console.log(
    `  opened a route   ${summary.openedRoute} (${pct(summary.openedRoute, summary.created)})`,
  );
  console.log(`  assigned a plane ${summary.assigned} (${pct(summary.assigned, summary.created)})`);
  console.log(`  first landing*   ${summary.landed} (${pct(summary.landed, summary.created)})`);
  for (const [day, { eligible, retained }] of Object.entries(summary.retention)) {
    console.log(`  D${day} retained     ${retained}/${eligible} (${pct(retained, eligible)})`);
  }
  const ttfa = timeToFirstAssignment(journeys);
  const minutes = (sec: number | null) => (sec === null ? "—" : `${Math.round(sec / 60)} min`);
  console.log(
    `\nTime to first assignment (n=${ttfa.count}): median ${minutes(ttfa.median)}, p75 ${minutes(ttfa.p75)}`,
  );
  console.log("\nWeekly cohorts: week, created, route, assigned, D1, D7, D30");
  for (const cohort of weeklyCohorts(journeys, until)) {
    const d = (n: 1 | 7 | 30) => pct(cohort.retention[n].retained, cohort.retention[n].eligible);
    console.log(
      `  ${cohort.week}  ${cohort.created}  ${pct(cohort.openedRoute, cohort.created)}  ${pct(cohort.assigned, cohort.created)}  ${d(1)}  ${d(7)}  ${d(30)}`,
    );
  }
  console.log("\n* estimated: first assignment + flight time on that route.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
