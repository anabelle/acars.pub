# Fast "Tycoon" mode: options for decision D5

> **Session:** [S53](sessions/S53-tycoon-mode-design.md) · **Date:** 2026-10-07 · **Decision:** D5 (build a non-ranked fast "Tycoon" world?). The owner decides. This is a design doc; nothing here is built.

## The question

ACARS runs on the real clock (AGENTS.md Rule 2): a 7-hour flight takes 7 hours. That is the game's identity and what makes the ranked world fair. The cost is that a first session can feel like "nothing happens". Competitors answer this by pairing a real-time mode with a fast one (Airlines Manager's PRO and TYCOON).

D5 asks whether ACARS should offer a **non-ranked, accelerated world** for people who want to learn or play quickly, **without** compromising the 1:1 ranked world.

## Constraints any option must keep

1. **The ranked world stays 1:1 and untouched.** No accelerated event may ever reach ranked state, leaderboards or the market.
2. **Determinism.** Every client must compute the same state from the same events (Rule 1). A fast world needs its own fixed clock that every client agrees on, not a per-player speed setting.
3. **No progression carry-over by default.** Anything earned fast and moved into the ranked world is a way to buy rank with time compression.
4. **Same engine.** One reducer, one economy. Two rule sets would double every balance change.

## What exists today

- **Worlds are already namespaced.** Every game event carries a `world` tag and a `d`-tag prefix `airtr:world:<WORLD_ID>:…` (`WORLD_ID = "v6-beta"`, in `packages/nostr/src/schema.ts`). A second world with its own id would be invisible to the ranked world by construction: different filter, different `d` tags.
- **The clock is a constant.** `tick = (now − GENESIS_TIME) / TICK_DURATION`, with `TICK_DURATION = 3000 ms`. Everything game-side is in ticks: flights, deliveries (`deliveryTimeTicks`), leases, maintenance, world events (S33), daily objectives (S32), fuel prices. So a world whose clock runs N times faster speeds the whole economy up uniformly.
- **But the 1:1 assumption is spread around.** `TICK_DURATION` appears in 22 source files (76 uses) and `GENESIS_TIME` in 15 (55 uses), mostly converting between ticks and wall time: countdowns, the away report, the map clock, objective day windows, catch-up. In a fast world, each of these needs to read the world's clock instead of the constants.
- **"Nothing happens" has already been worked on in the real world**, and should be measured before a second world is built:
  - Instant guest play (S20, S21, S26).
  - A first-hour checklist (S31).
  - First flights about 3 minutes after launch.
  - Daily objectives (S32) and world events (S33).
  - Away reports and celebrations.
- **There is no evidence yet.** The latest funnel report ([`metrics/2026-10-06.md`](metrics/2026-10-06.md)) covers 30 days with almost no players, so there is no D1/D7 retention figure to show that pacing is the problem. D5 says to build "only if D7 retention data supports it". That data doesn't exist yet.

## Option A: a separate fast world ("Tycoon" world)

A second public world (`WORLD_ID = "tycoon-1"`) on the same code, with a faster clock. Everyone in it shares one accelerated timeline: a real multiplayer world, just quicker.

- **Speed:** 24×. One game day per real hour, a 7-hour flight in about 17 minutes, a week in 7 hours. Fast enough to see a season of decisions in an evening; slow enough that check-ins still matter. (60× makes the map a blur and leaves no time to react to world events.)
- **Clock:** a per-world `WorldClock { genesis, msPerTick }`. The ranked world keeps `msPerTick = 3000`; Tycoon uses `125`. Every `TICK_DURATION` / `GENESIS_TIME` use goes through the active world's clock.
- **Seasons:** at 24× a ranked year passes every 15 days, and replay cost grows with history. Reset the Tycoon world on a fixed calendar (a new genesis and `WORLD_ID` each month, `tycoon-2026-11`). The reset is the "new season" moment and bounds sync cost.
- **Isolation:** its own `WORLD_ID`, so its events never match ranked filters. Optionally use its own event kind as well (belt and braces against a bad filter).
- **Leaderboard:** its own, clearly labelled, per season. Never mixed with ranked.
- **Carry-over:** none. You keep a personal "season record" (best rank, best profit) for bragging.
- **Pros:** real multiplayer, so rivals, the market and events feel alive at speed. A natural "season" cadence for growth. Same engine.
- **Cons:**
  - The biggest build: the clock abstraction across the app, a world switcher, a second relay namespace and season resets.
  - It splits a small player base across two worlds.
  - Event volume is about 24× per airline-hour on relays.
  - Real-time features (notifications "your flight landed") become noisy.

## Option B: a local fast practice run (single-player)

A private, offline airline that runs at high speed in the browser and publishes nothing. It is a flight simulator for the business: learn routes, fleets and fares in an afternoon, then start for real.

- **Speed:** 60× by default (a game day in 24 minutes), with a pause and a 4× / 60× / 240× selector, since nothing is shared.
- **Clock:** the same `WorldClock` idea, but local: the player's own genesis and multiplier. Rivals are seeded bots, or a frozen snapshot of the ranked world's rivals taken when the run starts (their routes compete in the market, but they don't react).
- **Isolation:** total. Actions go to a local log reduced by the same `actionReducer`, the "option A" sandbox design already written in S26.1. Nothing reaches relays.
- **Carry-over:** none. Optionally "start your real airline at this hub" pre-fills the creator. That's a preference, not progress.
- **Pros:**
  - No relay load, no fairness questions, no split player base.
  - Doubles as the tutorial for the 1:1 world.
  - Reuses S26's sandbox design.
  - It can ship before there are many players, because it doesn't need any.
- **Cons:**
  - No real multiplayer: the market is bots or a frozen snapshot.
  - It needs a "who am I" path with no pubkey, the cost S26 flagged as the main risk of the full sandbox.
  - It still needs the clock abstraction, although only in the store and engine, not the network.

## Option C: no second mode, make the 1:1 world eventful

Keep one world. Attack "nothing happens" directly in the real-time game:

- **A time-lapse.** The away report (and a "replay today" button) plays the last hours on the map at 60× as a cosmetic animation of what really happened. The player sees an evening's flights in 20 seconds without changing game time.
- **Shorter first loop.** Starter route suggestions favour 1–2 hour hops, so the first landing comes within the first session. S31's checklist already points there; tighten it.
- **More "act now" moments.** World events and daily objectives (S32, S33) are already in; add event-themed objectives and push notifications for the ones that touch the player.
- **Pros:** cheapest; strengthens the core game; no new identity, clock or world.
- **Cons:** doesn't serve players who want a whole season in an evening. If pacing is what churns them, this only softens it.

## At a glance

|                           | A: Tycoon world                | B: Local practice run           | C: Eventful 1:1      |
| ------------------------- | ------------------------------ | ------------------------------- | -------------------- |
| Multiplayer               | Yes, at 24×                    | No (bots or snapshot rivals)    | Yes (the real world) |
| Risk to the ranked world  | Low (separate `WORLD_ID`)      | None (nothing published)        | None                 |
| Relay load                | About 24× per airline-hour     | None                            | None                 |
| New infrastructure        | Clock, world switcher, seasons | Clock (local), sandbox identity | None                 |
| Needs players to be fun   | Yes                            | No                              | Yes                  |
| Serves "a season tonight" | Yes                            | Yes (solo)                      | No                   |

The recommendation and cost estimate follow in the next section (S53.2).

## Recommendation (S53.2)

**Do C now. Prepare B as the fast mode, built only if the data asks for it. Defer A until the ranked world is busy.**

1. **C first (now).** It improves the one world every player sees and costs no new infrastructure. It is also how we learn whether pacing is the real problem: if first sessions with a time-lapse and a 1–2 hour first flight still churn, the case for a fast mode becomes evidence instead of a hunch.
2. **B is the right fast mode for ACARS today**, when the data supports it. It answers "nothing happens" for a newcomer without splitting a small player base or risking the ranked world, and it doubles as the tutorial. Its biggest piece, the local sandbox, was already designed in S26.1.
3. **A only when the ranked world is busy enough to share players.** A second multiplayer world is only fun with rivals. Splitting a small community in two makes both feel empty.

### What would trigger B (proposed bar for D5)

Measured by the funnel report (`pnpm funnel --report`) over at least 4 weekly cohorts of 50 or more new airlines, with C shipped:

- D1 retention is at least 35% (people like the game), **but**
- D7 is under 15% (they don't stay for the real-time loop), **and**
- the median time to first landing is under 60 minutes (so the first loop is not the problem).

If D1 is low too, the issue is onboarding or the game itself, not pacing: fix that first. If D7 is healthy, don't build a fast mode.

### Cost estimate

In the overhaul's own units: steps (one commit each, gate green), grouped into sessions.

| Piece                                                                                   | Needed by | Size | Steps |
| --------------------------------------------------------------------------------------- | --------- | ---- | ----: |
| **World clock:** `WorldClock { genesis, msPerTick }` in core; the 22 + 15 files read it | A, B      | M    |     3 |
| **C:** time-lapse replay of the last hours on the map (cosmetic)                        | C         | M    |     3 |
| **C:** starter routes biased to 1–2 h hops; checklist copy                              | C         | S    |     1 |
| **C:** event-themed objectives and push for events touching the player                  | C         | S    |     2 |
| **B:** local sandbox identity and action log (S26.1 option A)                           | B         | L    |     4 |
| **B:** rivals for the practice run (seeded bots or a frozen snapshot)                   | B         | M    |     2 |
| **B:** speed control, "start for real" hand-off, UI mode banner                         | B         | S    |     2 |
| **A:** world switcher, per-world relays, filters and storage                            | A         | M    |     3 |
| **A:** seasons (monthly genesis and `WORLD_ID`), per-season leaderboard                 | A         | M    |     3 |
| **A:** relay load test at 24× and notification throttling                               | A         | S    |     2 |

| Path                | Steps | Roughly                                                |
| ------------------- | ----: | ------------------------------------------------------ |
| **C**               |     6 | Two sessions                                           |
| **B** (after C)     |    11 | Four sessions (clock plus sandbox plus rivals plus UI) |
| **A**               |    14 | Five sessions, plus ongoing season operations          |
| **B, then A** later |    22 | Shares the world clock (built once)                    |

Risks:

- **The clock abstraction touches many files.** A missed conversion makes a fast world drift between clients. Mitigation: a single `useWorldClock()`, plus a lint rule banning direct `TICK_DURATION`/`GENESIS_TIME` imports outside core.
- **B's no-pubkey path** is the risk S26 flagged. Keep it read-only towards relays and behind one `sandbox` flag in the identity slice.
- **A's event volume** is about 24× per active airline-hour. Measure it on the S54 relay set before launch.

### What the owner decides (D5)

- [ ] **C now**: queue a session for the time-lapse, starter routes and event objectives (recommended).
- [ ] **Bar for B**: accept the D1/D7/time-to-first-landing bar above, or set your own.
- [ ] **A**: defer until the ranked world is busy (recommended), or plan it now.
