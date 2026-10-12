# S67 — Hub banks and connecting passengers

> **Status:** ☑ merged
> **Next step:** — (merged in #200)
> **Branch:** `claude/zen-darwin-3op878`
> **PR:** #200
>
> **Track:** Decisions · **Size:** M (4 steps) · **Depends on:** D10 ✅ (2026-10-12), S66 · **Unblocks:** S73 alliances · **From:** [`../BLUEPRINT.md`](../BLUEPRINT.md) §6 Decisions

> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

A hub earns more than the sum of its routes: people flying Lisbon→Berlin with no direct flight connect through your Madrid hub on two of your flights. A well-timed hub — arrivals followed by departures 45 minutes to 3 hours later, a bank — connects more of them; a detour connects fewer.

## Design (Rule 3: never one passenger at a time)

- For each airport H where the airline has two or more routes, and each pair of its routes A–H and H–B where it does not fly A–B direct: weekly connecting passengers = addressable A→B market × 15 % × detour factor (1 on the way, 0 at a 50 % detour) × bank quality (0.5 with random timings, up to 1 when every timed arrival has a departure 45 min – 3 h later, from lines of flying).
- They join the weekly demand of both legs (A→H and H→B), like local passengers (same fares, same seats); landings record how many aboard were connecting.
- Computed once per game hour per network (cached), O(routes at each hub²); nothing per passenger.

## Steps (checkpoints)

- [x] **S67.1** Core: `detourFactor`, `bankQuality`, `connectingDemand`. _Done when:_ unit tests.
- [x] **S67.2** Store: `buildConnectionService` (per directed leg, cached per hour), injected into a leg's demand in the live engine; landing details `connectingPassengers`. _Done when:_ engine tests (pairs, no double count with direct routes, bank timing raises it).
- [x] **S67.3** UI: the airport panel shows connections at your hub (people a day, best pairs, bank quality with a tip); the receipt and cabin say how many connected.
- [x] **S67.4** e2e + screenshots; PR.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`.

2026-10-12 · brief · (this commit) · Written after the owner's D10 "yes, after chains" and a read of the per-leg demand path (`computeFlightPassengers`: gravity → addressable → incumbent/QSI share → per-flight).

2026-10-12 · S67.1 · (this commit) · **The connection maths, in core.** `connections.ts`: `detourFactor`, `bankQuality` (wraps midnight; 45 min–3 h window), `connectingDemand` (15 % × detour × quality of the addressable market). Tests.

2026-10-12 · S67.2 · (this commit) · **Connections fly.** `connections.ts` (store): `computeConnectionService` — per airport with 2+ of the airline's routes, every pair it does not fly direct (largest 30 partner markets), addressable A→B demand × 15 % × detour × bank quality (timed arrivals/departures from lines), added to both directed legs; per hub: quality, weekly connecting passengers, top 5 pairs. `buildConnectionService` caches it per game hour and network/line signature. The live engine adds a leg's connecting pool to its own weekly allocation (same seats, same fares; cycle planes and line legs alike); `FlightPassengerResult.connectingShare`; landing details `connectingPassengers`. Catch-up estimates keep using the last load factor. Tests: both legs carry them, no pair flown direct, a bank raises quality to 1 and the flow, cache, more seats filled with a connecting pool. Store 295/295.

2026-10-12 · S67.3 · (this commit) · **Connections on screen.** `HubConnections` in the airport panel (own airline, only where people connect): "N people a day connect through MAD on two of your flights", readouts for connecting/day and bank timing (amber under 80 %), the biggest flows ("LIS→BCN 42"), and a tip to time arrivals 45 min–3 h before departures with a Day plan. The last flight's cabin line adds "12 connecting". `useHubConnections` re-reads once per game hour. Tests: component (hub with flows and tip; silent elsewhere). Web feature suites green.

2026-10-12 · S67.4 · (this commit) · **e2e and screenshots; S67 complete.** `connections` (desktop) and `mobile-connections` (phone): an airline flying MAD–BCN and MAD–LIS for three hours shows Madrid's connections card ("264 people a day want to connect", BCN→LIS 136 · LIS→BCN 128, bank 50 % with the timing tip). Wording says "want to connect (seats permitting)": it is demand; seats decide how many board. Screenshots: [`hub-connections-1440`](../media/s67/hub-connections-1440.png), [`hub-connections-390`](../media/s67/hub-connections-390.png).

2026-10-12 · merged · 0f8d3ee · Squash-merged in #200.
