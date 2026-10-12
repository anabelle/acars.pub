# S73 — Alliances and codeshares

> **Status:** ☑ done (awaiting merge)
> **Next step:** — (merge the PR)
> **Branch:** `claude/zen-darwin-3op878`
> **PR:** #201 (with S68–S72, S74)
>
> **Track:** Social · **Size:** M (4 steps) · **Depends on:** D16 ✅ (2026-10-12 "later"; owner chose "alliances now" the same evening), S67 · **From:** [`../BLUEPRINT.md`](../BLUEPRINT.md) §4 Social, §5 game theory ("cooperation pays in a repeated game")

> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

Two airlines can ally: where one's route meets the other's at an airport, passengers connect across both, so each partner's flights carry people the other brought. Competing everywhere else stays.

## Design

- **Consent:** each airline names up to 3 partners in its own log (`ALLIANCE_SET { partners }`). An alliance is active only when both name each other (mutual). Proposing is naming; accepting is naming back; leaving is dropping the name. No server, no arbiter.
- **Codeshare connections (aggregate, per leg):** at every airport where one of my routes meets an ally's route, each market A→B that neither of us flies direct gets `CODESHARE_SHARE` (0.7) of the usual connecting demand (S67: detour, bank quality from my lines), credited to my leg only. My ally's client computes its leg the same way. Never per passenger; at most 30 ends per hub, as in S67.
- **Where it applies:** the live engine and catch-up (through the S67 connection service), from allies' routes as the world sync already replays them.
- **Visible:** on a rival's airline page: "Propose an alliance" / "Proposed — waiting for them" / "They proposed — accept" / "Allies" with "Leave"; allies marked on the leaderboard; the hub card counts passengers connecting to allies.
- **Bounded:** at most 3 partners; one extra spoke list per hub; the connection service stays cached per game hour.

## Steps (checkpoints)

- [x] **S73.1** Core: `MAX_ALLIANCE_PARTNERS`, `CODESHARE_SHARE`, `parsePartners`, `mutualPartners`, `allianceStatus`; `AirlineEntity.alliancePartners`; tests.
- [x] **S73.2** Store: replay `ALLIANCE_SET`, `setAlliancePartners`, codeshare connections from allies' routes in engine and catch-up; tests.
- [x] **S73.3** Web: alliance control on rivals' pages, allies on the leaderboard, codeshare passengers on the hub card; i18n; tests.
- [x] **S73.4** e2e (desktop and phone), screenshots, PR.

## Progress log

2026-10-12 · brief · (this commit) · Written after the owner chose "alliances now" and a read of the S67 connection service (spokes per hub, bank quality, per-leg credit).

2026-10-12 · S73.1 · (this commit) · **Alliance rules, in core.** `alliance.ts`: `MAX_ALLIANCE_PARTNERS` = 3, `CODESHARE_SHARE` = 0.7, `parsePartners` (unique valid pubkeys, never oneself, at most three), `allianceStatus` (none / proposed / invited / allied), `mutualPartners`. Types: `AirlineEntity.alliancePartners`, action `ALLIANCE_SET`. 3 tests; core 461/461, 100 % functions.

2026-10-12 · S73.2 · (this commit) · **Alliances in the game.**

- Replay: `ALLIANCE_SET` stores `airline.alliancePartners` (`parsePartners`: never oneself, at most three; garbage ignored; an empty list clears) with a timeline line.
- Store: `setAlliancePartners` (optimistic, publishes, rolls back only the list on failure). `alliedRoutes(state)` (engine slice): routes of partners who name us back, from the world sync's `routesByOwner`.
- Connections: `computeConnectionService(…, allyRoutes)` — at each airport where our route meets an ally's, markets neither flies direct (and within the S67 detour) get `CODESHARE_SHARE` of the connecting demand on our leg only; ally ends we already serve are left to our own banks; `HubConnections.codeshareWeekly`. `buildConnectionService` keys its hourly cache on ally routes too; the engine gets them through its context (`allyRoutes`).
- Tests: replay (partners, self, garbage, clear), connections (our leg only, direct markets skipped, own banks unchanged, no-overlap cases), `alliedRoutes` (mutual only), slice (publish, rollback). Store 321/321; web 717/717 unchanged.

2026-10-12 · S73.3 · (this commit) · **Alliances, on screen.**

- `AllianceControl` on a rival's airline page: "Propose an alliance" → "You proposed an alliance. It starts when they accept." (Withdraw); "They proposed an alliance to you." → "Accept the alliance"; "Allies: passengers connect across both networks where your routes meet." (Leave the alliance); disabled with "At most 3 partners: leave one first." when full. Hidden on your own page and without an airline.
- `AllyBadge` ("Ally") next to allied airlines on the leaderboard.
- Hub card: "N people a day connect here to your allies' flights." (`hub-codeshare`); a codeshare-only airport shows just that line. `useHubConnections` passes `alliedRoutes` (now `@acars/store/alliance`, exported) to the connection service.
- i18n en/es `alliance.*`, `connections.codeshare_*`. Tests: control (propose/withdraw, accept/leave, full, hidden), badge, hub card with an ally. Web 722/722; store 323/323.

2026-10-12 · S73.4 · (this commit) · **Two players, one alliance.** New e2e helper `sharedRelay.ts`: one fake relay shared by several pages that stores what is published (addressable and replaceable events replaced as relays do) and serves it back, live, to every matching subscription. e2e `alliances.spec.ts` (1440) and `mobile-alliances.spec.ts` (390): Alpha Air and Bravo Air are created in two browser contexts on that relay; Alpha proposes on Bravo's page; Bravo sees "They proposed an alliance to you." on Alpha's page and accepts; both see "Allies". (First run found that with two airlines on the board the first row isn't always yours: the spec picks the row marked "Your Airline".) Screenshots: `media/s73/alliance-invited-{1440,390}.png`, `media/s73/alliance-allied-{1440,390}.png`. Ships in #201 (same branch).
