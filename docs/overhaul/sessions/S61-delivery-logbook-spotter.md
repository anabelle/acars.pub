# S61 — Delivery day, names, logbook and the spotter's book

> **Status:** ◐ in progress
> **Next step:** S61.3
> **Branch:** `claude/zen-darwin-3op878`
> **PR:** —
>
> **Track:** Pride · **Size:** M (4 steps) · **Depends on:** S60 · **Unblocks:** S62 (Today story uses deliveries) · **From:** [`../BLUEPRINT.md`](../BLUEPRINT.md) §6 Pride
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

Every plane is someone: it arrives with a name and a ceremony, keeps a logbook, and fills a page in the spotter's book. The "collect them with love" loop.

## Why

- Owner, 2026-10-10: "a super triumph aspect to collect the planes with love".
- Today planes are named "ATR 42-600 1"; a delivery is a toast; nothing remembers what a plane has done; nothing shows which types are left to collect.

## Constraints found

- **No rename action exists**, but `AIRCRAFT_PURCHASE` already carries a `name` (`purchaseAircraft(..., customName)`), so naming happens **at order time** with no rule change (Wave A guard rail). Renaming later is out of scope (would need a new action).
- The timeline keeps the last **1,000** events (`MAX_TIMELINE_EVENTS`), so lifetime totals beyond `flightHoursTotal` cannot be rebuilt; the logbook labels timeline figures as "recent".
- Delivery already emits a `delivery` timeline event (`FlightEngine`), so the ceremony needs no engine change.

## Steps (checkpoints)

- [x] **S61.1** Names: `suggestPlaneName` (curated evocative names, deterministic by seed, never a duplicate in the fleet); route launch leases with a suggested name; the dealer pre-fills it with "another name". _Done when:_ unit tests (deterministic, unique, fallback when the list is exhausted) + dealer/launch tests.
- [x] **S61.2** Delivery day: a one-time ceremony on a plane's `delivery` event — water salute over the painting (reduced motion: a still frame), the name on a sign, "first of its type" variant, first flight line when assigned. Celebrated ids remembered per airline. _Done when:_ component tests + e2e (launch → ceremony → dismissed, not shown again) + 1440/390 screenshots.
- [ ] **S61.3** Logbook in the plane panel: lifetime hours; recent landings, passengers, distance (times round the Earth), money, on-time share, airports visited as passport stamps. _Done when:_ unit tests for the summary + panel test + screenshot.
- [ ] **S61.4** Spotter's book in the fleet panel: every catalog type as owned (count, painting) / next (unlocked) / locked (tier), completion "n / N". _Done when:_ component test + e2e + screenshots; PR with screenshots, ready when CI is green.

## Acceptance criteria

- [ ] A new player's first plane arrives with a real name and a ceremony.
- [ ] No plane is ever named "<model> <n>" by the game's own flows.
- [ ] Each plane shows what it has done; the airline sees which types it has collected and which are next.
- [ ] Reduced motion respected; clipped-control audit and full e2e green.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

2026-10-11 · brief · (this commit) · Written after checking purchase naming, timeline retention and delivery events.

2026-10-11 · S61.1 · (this commit) · **Planes arrive with names.**

- `suggestPlaneName(seed, taken)` (`features/fleet/utils/planeNames.ts`): 120 curated names (birds, winds, stars, islands, flowers, landmarks; readable in English and Spanish), FNV-hashed by seed so every client agrees, never a name the fleet already uses (case-insensitive), "Quetzal II" once all are taken.
- Route launch leases with a suggested name (seed = airline + fleet size); the dealer pre-fills the name field ("Name", was "optional") with an "Another" button. Both go through the existing `AIRCRAFT_PURCHASE` `name` field: no rule change.
- Tests: names (deterministic, unique, numeral fallback, no digits), dealer (pre-filled, another); e2e purchase helpers read and check the chosen name. Web unit and lint/typecheck green.

2026-10-11 · S61.2 · (this commit) · **Delivery day.**

- `DeliveryCeremony` (mounted in the root, subscribes outside render like `MilestoneCelebrations`): when a plane leaves "delivery" live (`findDeliveries`; catch-ups stay quiet), a dialog shows its painting under a water salute (two cyan arcs drawn once; still with reduced motion), its name on a location sign, "Your first <type>" for the first of a model, and "First flight PTY → SJO, already selling" when it has a route. "Meet <name>" opens the plane; queued if several arrive together.
- Leftover green glows removed (tier-up dialog, sidebar active item).
- e2e: `continuePastDelivery` closes the ceremony like a player would; the key-backup specs (which fast-forward past the delivery) use it. The full e2e suite was run locally with the ceremony: only those two specs needed it.
- Screenshots: [`delivery-1440`](../media/s61/delivery-1440.png), [`delivery-390`](../media/s61/delivery-390.png).
