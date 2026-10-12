# S65 — ACARS feed from engine events

> **Status:** ☑ done (awaiting merge)
> **Next step:** — (merge #199)
> **Branch:** `claude/zen-darwin-3op878`
> **PR:** #199 (with S61–S64)
>
> **Track:** Real · **Size:** S–M (3 steps) · **Depends on:** S60 · **Unblocks:** weather messages (S68) · **From:** [`../BLUEPRINT.md`](../BLUEPRINT.md) §2 Real, §4 "A plane", §6

> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

The airline talks like a real one. Every leg sends the four OOOI messages (OUT of the gate, OFF the runway, ON the runway, IN at the gate) and, while cruising, an hourly position report, in the terse ACARS style dispatchers read. A plane shows its last messages; the cockpit shows the airline's feed.

## Constraints

- Nothing new is stored or broadcast: every message is derived from what the engine already records (landing events with block time, load and passengers; the flight in the air). Deterministic on every client (taxi times hashed from the leg).
- Bounded: one pass over the timeline (≤ 1,000 events) plus planes in the air, last 24 h, at most 3 position reports per flight, a fixed number of messages kept. Re-derived once per game minute.
- Message codes and bodies stay in ACARS English on every locale (as real ACARS does); the labels around them are translated.

## Steps (checkpoints)

- [x] **S65.1** `buildAcarsFeed`: OUT/OFF/POS/ON/IN per leg (taxi 8–17 min out, 3–9 in, capped by block time; cruise level by stage length; positions on the great circle at whole UTC hours; IN with passengers and load). _Done when:_ unit tests.
- [x] **S65.2** UI: `AcarsFeed` (green-on-black printer lines, code coloured by phase) in the plane panel (that plane, last 8) and in the cockpit under the instruments (the airline, last 12, names open the plane). _Done when:_ component tests.
- [x] **S65.3** e2e (desktop and phone) + 1440/390 screenshots; PR.

## Acceptance criteria

- [x] A plane that has flown shows its OOOI messages with UTC times; one in cruise shows position reports.
- [x] The cockpit shows the airline's latest messages, newest first.
- [x] No per-passenger work; clipped-control audit and full e2e green.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

2026-10-12 · brief · (this commit) · Written after checking what landings record (block time `flightDurationTicks`, load, passengers) and that game hours align with UTC hours (genesis on the hour).

2026-10-12 · S65.1 · (this commit) · **The messages.** `features/fleet/utils/acars.ts`: `buildAcarsFeed` (legs from landings in the window plus planes in the air; OUT "MAD-BCN ETA 17:12Z", OFF "MAD FL340", POS "40.52N 010.13W FL380 GS455" at whole UTC hours of the cruise, ON, IN "BCN PAX 140 LF 88%"; nothing after now), `taxiTicks`, `cruiseLevel`. Tests: OOOI order and bodies, hourly positions in cruise and none in the future, filters by plane, window and limit.

2026-10-12 · S65.2 · (this commit) · **The feed on screen.** `AcarsFeed` prints messages on the cockpit panel in B612 Mono: UTC time, (airline feed) the flight number as a link to the plane, the code coloured by phase (OUT/IN white, OFF/ON cyan, POS green), the body. `PlaneAcars` (last 8) sits in the plane panel under the last flight; `AirlineAcars` (last 12) under the cockpit instruments. `useAcarsFeed` re-derives once per game minute with the boards' flight numbers. Tests: component (rows, link opens the plane, empty state); feature suites 534/534.

2026-10-12 · S65.3 WIP · (this commit) · e2e specs `acars` and `mobile-acars` written (cockpit feed shows OUT/OFF/ON/IN with PAX/LF; flight number opens the plane, whose panel lists its messages); first run in progress. Remaining: green run, screenshots, PR update.

2026-10-12 · S65.3 WIP · (this commit) · First e2e run green on desktop and phone. The feed now uses `font-mono` (B612, tabular digits): B612 Mono spaced the punctuation ("05: 54Z"). Re-running for the final screenshots.

2026-10-12 · S65.3 · (this commit) · **e2e and screenshots; S65 complete.** `acars` (desktop) and `mobile-acars` (phone) green: after 4 h of flying the cockpit feed shows OUT/OFF/ON/IN with "PAX 42 LF 88%", the flight number opens the plane and its panel lists its own messages. Screenshots: [`airline-acars-1440`](../media/s65/airline-acars-1440.png), [`airline-acars-390`](../media/s65/airline-acars-390.png), [`plane-acars-1440`](../media/s65/plane-acars-1440.png), [`plane-acars-390`](../media/s65/plane-acars-390.png).
