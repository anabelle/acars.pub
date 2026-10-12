# S63 — Passengers visible: cabin, receipts, voices, turned away, booking bars

> **Status:** ◐ in progress
> **Next step:** S63.2
> **Branch:** `claude/zen-darwin-3op878`
> **PR:** —
>
> **Track:** People · **Size:** M (3 steps) · **Depends on:** S60, S62 · **Unblocks:** D13 (decide "fares while filling" after seeing this) · **From:** [`../BLUEPRINT.md`](../BLUEPRINT.md) §6 People
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

Passengers stop being one vague number. A plane shows its cabin by class, filled seat by seat; every landing has a receipt (tickets by class, every cost line, the net) and, now and then, a passenger's voice; airports show the people who could not get a seat; departure boards show how full each flight is.

## Why

- Owner, 2026-10-10: "passengers… a vague number with no fun to it, planes half full, seat classes, it all feels a bit empty".

## Constraints (Rule 3: never simulate passengers)

- Passengers aboard are computed at landing, not stored while flying. The cabin shows the **last landing's** passengers by class (labelled "last flight"), never an invented live count.
- Everything is drawn from aggregates: seat glyphs scale (one glyph per seat up to 120, then one per N seats); crowds are `PaxCrowd` (one figure = 10 people).
- Voices are chosen deterministically from the flight's own numbers (load, class mix, profit) and seeded by the event id; rare (about one landing in three) and never about real people.

## Steps (checkpoints)

- [x] **S63.1** Plane panel: `CabinStrip` (first / business / economy rows, filled vs empty, from the last landing or the last known load) and `LandingReceipt` (route, UTC time, tickets per class, ancillary, each cost line incl. handling and distribution, net) with an occasional voice. _Done when:_ unit tests (glyph scaling, receipt lines, voice determinism) + panel test.
- [ ] **S63.2** Airports and boards: the airport panel shows people turned away from the player's departures there in the last 24 h (pictograms, "add seats"); departure boards show a booking bar per flight. _Done when:_ component tests.
- [ ] **S63.3** e2e (desktop and phone) + 1440/390 screenshots; PR.

## Acceptance criteria

- [ ] Opening a plane that has landed shows its cabin by class and the last landing's receipt.
- [ ] An airport that turned people away says how many, with pictograms.
- [ ] Departure boards read fullness at a glance.
- [ ] No per-passenger loops; clipped-control audit and full e2e green.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

2026-10-12 · brief · (this commit) · Written after checking what a landing records (per-class passengers, revenue and cost lines, spill) and that boards already carry a load factor.

2026-10-12 · S63.1 · (this commit) · **The last flight: cabin, receipt, a voice.**

- `cabinRows`: per class (first, business, economy; empty classes left out) seats and filled seats from the last landing's counts (or the last known load on old events), one glyph per seat up to 120 seats, then one per N ("each mark is 2 seats").
- `landingReceipt`: tickets by class and ancillary, every recorded cost line (handling and distribution only when present), the net; null on events without a breakdown.
- `passengerVoice`: about one landing in three (FNV hash of the event id, so every client hears the same), chosen from the flight's own numbers: full, roomy, first class, business, smooth.
- `LastFlight` in the plane panel (own planes, under the logbook): the cabin strip (F magenta, J cyan, Y paint, empty seats grey) and a receipt printed on paint with dotted leaders, a red net when the flight lost money, and the voice signed with a deterministic seat ("— seat 14C").
- Tests: helpers (scaling, overfill, empty classes, receipt lines, voice determinism and rarity), component, panel.
