# ACARS Overhaul — Master Plan

> **Resuming work? Start at [`STATUS.md`](STATUS.md)**: it has the recommended order, the
> resume protocol and a copy-paste prompt. Run `scripts/overhaul-status.sh` to see live progress.

> Status: **plan** (2026-10-05). Companion to [`../PLAYABILITY_AUDIT.md`](../PLAYABILITY_AUDIT.md).
> The work is split into **independent sessions**. Each one has a self-contained brief in
> [`sessions/`](sessions/), so any agent or contributor can start from "Execute session
> S23" with no other context.

## 0. Goal

Turn a technically excellent simulation into a game people choose, keep and share. Every
session serves one of five outcomes:

1. **Decisions matter**: route, fare and fleet choices produce different results (Economy track).
2. **First flight in under 3 minutes**: anyone can understand and act without knowing Nostr (UX track).
3. **Every check-in says something**: a recap, goals and events between visits (Loop track).
4. **The map sells the game**: a living 3D globe that looks like a game (Graphics track).
5. **People can find, install and share it** (Growth track).

---

## 1. Assumption ledger

Every claim from the audit sessions was re-checked on 2026-10-05. Sessions must not rely on
anything marked _Unverified_ without checking it first.

| #   | Claim                                                            | Status                       | Evidence / correction                                                                                                                                                                                                                                     |
| --- | ---------------------------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | One aircraft fills any route (~87% LF) regardless of market size | ✅ Verified                  | Real `processFlightEngine` via `simulateSingleLanding`: MAD–BCN and DEN–SLC both 87% at suggested fares (addressable demand 140k vs 3k pax/week).                                                                                                         |
| A2  | Overpricing is always profitable                                 | ✅ Verified, **stronger**    | Real engine: MAD–BCN at 40× fare keeps 87% LF ($293k vs $3k profit/leg). Corrected: thin markets _don't_ punish it. DEN–SLC's best is ~5× and 40× still beats 1× by 3×.                                                                                   |
| A3  | Oversupply is double-penalized                                   | ✅ Verified, **corrected**   | Mechanism confirmed (`alloc/freq × pressure`). Real magnitude: 10 ATRs on DEN–SLC → 14% LF vs ~24% from a single division (earlier I wrote 4%).                                                                                                           |
| A4  | Progression is slow (28 days to Tier 2)                          | ⚠️ **Corrected**             | Only for a cautious 3-plane player. Lease deposit is 10% ($2.6M for an ATR 72) and nothing caps route count, so $100M funds ~30 leased planes on day one. Pacing is **bimodal**: a solved fast optimum vs. a slow naive path, with no intermediate goals. |
| A5  | Leasing strictly dominates buying                                | ✅ Verified                  | `fleetSlice.ts`: 10% deposit + $120k/mo vs $26M. Break-even ≈ 16 years of payments.                                                                                                                                                                       |
| A6  | Brand rises with LF > 0.85, so it rewards gouging                | ✅ Verified                  | `engineSlice.ts` brand update.                                                                                                                                                                                                                            |
| A7  | Fare cap is a flat $10,000                                       | ✅ Verified                  | `MAX_FARE` in `actionReducer.ts` and `networkSlice.ts`.                                                                                                                                                                                                   |
| A8  | First flight needs ~5 screens / 3 actions                        | ✅ Verified                  | Open route in `AirportInfoPanel` or `RouteManager`; buy/lease in `AircraftDealer`; `assignAircraftToRoute` is called **only** from `FleetManager.tsx`.                                                                                                    |
| A9  | Landing page promises unshipped features                         | ✅ Verified                  | `common.json` (IPO, takeover, P2P, Bitcoin) vs README "Planned".                                                                                                                                                                                          |
| A10 | "Connected" and "LIVE DATA" badges don't reflect relay health    | ✅ Verified                  | `creator.connectedSubtitle` is static; `Ticker.tsx` has no relay logic.                                                                                                                                                                                   |
| A11 | Hub suggestion takes 15–30 s                                     | ⚠️ **Corrected**             | It uses geolocation (3 s timeout), then time zone (UTC → Dakar is real). The long wait was probably sandbox catalog loading. Unverified in production.                                                                                                    |
| A12 | Mobile context bar overlaps the top banner                       | 🟡 Observed in dev only      | Reproduced at 390 px on `/`, `/?panel=cockpit` and `/join` in a local Vite build. Confirm on production.                                                                                                                                                  |
| A13 | Map is flat Mercator, not a globe                                | ✅ Verified                  | No projection setting anywhere in `packages/map` or `apps/web`.                                                                                                                                                                                           |
| A14 | Map was black in production ~13 days                             | 🟡 Likely                    | Regression `238cfae` (2026-09-10) and fix `fc6b969` (2026-09-23) are both on `main`. The Cloudflare Pages auto-deploy config isn't in the repo.                                                                                                           |
| A15 | No visual/e2e test in CI                                         | ✅ Verified                  | `ci.yml`: build, lint, typecheck, unit tests, audit only.                                                                                                                                                                                                 |
| A16 | No meta description / OG tags; title "Corporate Console"         | ✅ Verified                  | `apps/web/index.html`; no OG generation in `functions/`.                                                                                                                                                                                                  |
| A17 | No PWA manifest / service worker                                 | ✅ Verified                  | Nothing in `public/`, `index.html` or `src`.                                                                                                                                                                                                              |
| A18 | No analytics                                                     | ✅ Verified                  | No analytics library or calls.                                                                                                                                                                                                                            |
| A19 | No "while you were away" summary                                 | ✅ Verified                  | `TimelineToastBridge` shows ≤ 5 event toasts; no summary.                                                                                                                                                                                                 |
| A20 | `RouteManager.tsx` has ~30 hard-coded English strings            | 🟡 Approximate               | Regex estimate; S24 must do a precise sweep.                                                                                                                                                                                                              |
| A21 | Logged-in screens' visual quality                                | ❌ Unverified                | Never rendered (relays blocked in the audit sandbox). Code review only.                                                                                                                                                                                   |
| A22 | Android app not published                                        | ❌ Unverified                | Capacitor scaffold exists; no store link found. **Ask the owner.**                                                                                                                                                                                        |
| A23 | Market size (15M+ / 27M installs) and Nostr ~144k DAU            | 🟡 Sourced, mixed confidence | Publisher claims and investor releases are solid; the Nostr DAU source is secondary and inconsistent.                                                                                                                                                     |
| A24 | "Zero traction"                                                  | ❌ Unmeasured                | The owner's report. There's no instrumentation; S04 makes it measurable.                                                                                                                                                                                  |

---

## 2. Decisions the owner must make

Sessions marked "gated" stop and ask if their decision is still open.

| ID  | Decision                                                                                                | Blocks    | Recommendation                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------- |
| D1  | Is the flat ~87% LF intentional beginner-friendliness?                                                  | S10       | No. Keep a gentle Tier 1 by giving the incumbent less share on short routes, not by flattening.             |
| D2  | Accept rule changes keyed to an **activation tick** (old ticks replay with old rules)?                  | S03→all E | Yes. It's the only way to change economics without breaking replay.                                         |
| D3  | Notifications: allow a small push relay (Cloudflare Function + KV for subscriptions) or Nostr DMs only? | S34       | Nostr DM bot first (no new state); web push later as opt-in.                                                |
| D4  | Go/no-go on a globe-first 3D shell after the prototype                                                  | S45→rest  | Decide on the S45 perf report and playtest.                                                                 |
| D5  | Build a non-ranked fast "Tycoon" sandbox world?                                                         | S53       | Design doc first; build only if D7 retention data supports it.                                              |
| D6  | How are rewards (objectives, referrals) validated without an arbiter?                                   | S32, S51  | Rewards are pure functions of the action log + date seed; any client recomputes and rejects invalid claims. |
| D7  | Who owns store accounts (Google Play), domain and social channels?                                      | S52, S50  | Owner action; sessions only prepare the artifacts.                                                          |

---

## 3. Session index

Size: **S** ≈ half a session, **M** ≈ one session, **L** ≈ one or two sessions.
Live status is **not** kept here: it lives in each brief and is printed by `scripts/overhaul-status.sh`. See [`STATUS.md`](STATUS.md) for the recommended order and the resume protocol.

### Track 0 — Foundations

| ID                                             | Title                                  | Size | Depends on |
| ---------------------------------------------- | -------------------------------------- | ---- | ---------- |
| [S01](sessions/S01-browser-smoke-tests.md)     | Browser smoke & screenshot tests in CI | M    | —          |
| [S02](sessions/S02-economy-balance-harness.md) | Economy balance harness                | M    | —          |
| [S03](sessions/S03-ruleset-versioning.md)      | Ruleset versioning by activation tick  | L    | S02, D2    |
| [S04](sessions/S04-funnel-metrics.md)          | Funnel metrics from Nostr events       | M    | —          |

### Track E — Economy (sequential; all changes go through S03)

| ID                                            | Title                                      | Size | Depends on |
| --------------------------------------------- | ------------------------------------------ | ---- | ---------- |
| [S10](sessions/S10-market-model-v2.md)        | Market model v2: incumbents + fare cap     | L    | S03, D1    |
| [S11](sessions/S11-oversupply-and-brand.md)   | Oversupply curve + brand score v2          | M    | S10        |
| [S12](sessions/S12-fleet-economics-pacing.md) | Lease vs buy, tier pacing, milestone rungs | M    | S11        |
| [S13](sessions/S13-auto-maintenance.md)       | Auto-maintenance policy                    | M    | S03        |

### Track U — UX

| ID                                     | Title                                                       | Size | Depends on |
| -------------------------------------- | ----------------------------------------------------------- | ---- | ---------- |
| [S20](sessions/S20-front-door.md)      | Front door: honest landing, entry layout, meta              | M    | —          |
| [S21](sessions/S21-airline-creator.md) | Quick-start airline creator                                 | M    | —          |
| [S22](sessions/S22-shell-clarity.md)   | Shell clarity: naming, status bar, real health              | M    | S20        |
| [S23](sessions/S23-route-launch.md)    | Route projection + airport decision card + one-click launch | L    | —          |
| [S24](sessions/S24-fare-editor.md)     | Outcome-first fare editor + RouteManager i18n               | M    | S23        |
| [S25](sessions/S25-assignment.md)      | Assign from both sides + ferry-and-assign                   | M    | S23        |
| [S26](sessions/S26-guest-sandbox.md)   | Guest sandbox airline                                       | L    | S21, S23   |

### Track L — Check-in loop

| ID                                        | Title                                | Size | Depends on |
| ----------------------------------------- | ------------------------------------ | ---- | ---------- |
| [S30](sessions/S30-away-report.md)        | "While you were away" report         | M    | —          |
| [S31](sessions/S31-goals-and-progress.md) | First-hour checklist + tier progress | M    | S22        |
| [S32](sessions/S32-daily-objectives.md)   | Deterministic daily objectives       | L    | S03, D6    |
| [S33](sessions/S33-world-events.md)       | Deterministic world events           | L    | S03        |
| [S34](sessions/S34-notifications.md)      | PWA + notifications                  | M    | D3         |

### Track G — Graphics

| ID                                           | Title                                    | Size | Depends on |
| -------------------------------------------- | ---------------------------------------- | ---- | ---------- |
| [S40](sessions/S40-globe.md)                 | Real globe + atmosphere + fly-to         | M    | S01        |
| [S41](sessions/S41-living-routes.md)         | Living routes                            | M    | S40        |
| [S42](sessions/S42-aircraft-visuals.md)      | Aircraft family icons + livery tint      | M    | S41        |
| [S43](sessions/S43-economy-on-map.md)        | Economy on the map                       | M    | S42, S23   |
| [S44](sessions/S44-livery-hero.md)           | Livery as hero + fleet poster            | M    | —          |
| [S45](sessions/S45-globe-first-prototype.md) | Globe-first 3D shell prototype (deck.gl) | L    | S01        |

### Track F — Growth

| ID                                          | Title                                    | Size | Depends on   |
| ------------------------------------------- | ---------------------------------------- | ---- | ------------ |
| [S50](sessions/S50-public-airline-pages.md) | Public airline pages + dynamic OG images | M    | S20          |
| [S51](sessions/S51-share-loop.md)           | Share loop + milestone posts             | M    | S44, S50, D6 |
| [S52](sessions/S52-android-release.md)      | Android / Play release readiness         | M    | S34, D7      |
| [S53](sessions/S53-tycoon-mode-design.md)   | Fast "Tycoon" sandbox: design doc        | S    | S04, D5      |

---

## 4. Waves (what can run in parallel)

Sessions in the same wave touch disjoint files and can run at the same time.

| Wave | Sessions                               | Why this order                                                                                           |
| ---- | -------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1    | S01, S02, S04, S20, S21, S23, S30, S44 | No dependencies. They build the safety net and measurement, and ship the biggest first-impression fixes. |
| 2    | S03, S22, S24, S25, S40, S45, S34, S50 | Need wave-1 foundations (S01 for map work, S02 for S03, S23 for route UI, S20 for shell and meta).       |
| 3    | S10, S11, S31, S41, S42, S26, S51      | Economy v2 on the ruleset; graphics build on the globe; growth builds on public pages.                   |
| 4    | S12, S13, S32, S33, S43, S52, S53      | Pacing tuned against v2 economics; loop content on the ruleset; release once notifications exist.        |

```
S02 ─► S03 ─► S10 ─► S11 ─► S12
          ├─► S13
          ├─► S32
          └─► S33
S01 ─► S40 ─► S41 ─► S42 ─► S43 ◄─ S23
   └─► S45 (decision D4)
S20 ─► S22 ─► S31
   └─► S50 ─► S51 ◄─ S44
S23 ─► S24
   ├─► S25
   └─► S26 ◄─ S21
S34 ─► S52
S04 ─► S53
```

**Hot files**: only one active session at a time per file.

- `packages/map/src/Globe.tsx`: S40 → S41 → S42 → S43 (S45 uses new files only).
- `packages/store/src/FlightEngine.ts` and `packages/core/src/demand.ts`/`qsi.ts`: S03 → S10 → S11 → S12/S13/S32/S33. Run S32 and S33 one after the other.
- `apps/web/src/features/network/components/RouteManager.tsx`: S23 → S24 → S25.
- `apps/web/src/shared/components/layout/*`: S20 → S22 → S31.

---

## 5. Session protocol

The step-by-step resume and checkpoint protocol is in [`STATUS.md` §2](STATUS.md#2-resume-protocol-agents-follow-this-exactly).
It applies to every session. In short: one step = one green commit, pushed immediately, with
the brief's progress log updated in the same commit.

**Guardrails** (non-negotiable, from `AGENTS.md`):

- No change to numeric engine outputs for past ticks. Economy changes ship as a new ruleset
  version with an activation tick (S03).
- Money is fixed-point (`fp*`) only. No floats in state.
- Lists are virtualized; map visuals are WebGL layers, never DOM per aircraft.
- Every new user-facing string goes in `en` and `es` locales.
- Nostr is the database: no new server-side state unless an owner decision allows it.
- Stay in the brief's scope. Anything else goes in its "Follow-ups" section.
- Proof:
  - logic gets unit tests;
  - UI gets 390×844 and 1440×900 screenshots (S01 harness);
  - economy gets a before/after S02 report.

## 6. Success metrics (measured by S04 once it lands)

| Outcome              | Metric                                                    | Target                            |
| -------------------- | --------------------------------------------------------- | --------------------------------- |
| First flight < 3 min | Median time from `AIRLINE_CREATE` to first assignment     | < 3 min                           |
| Activation           | % of new airlines with ≥ 1 assigned aircraft in session 1 | > 80%                             |
| Decisions matter     | Spread of profit/day across a player's routes (S02 sim)   | Coefficient of variation > 0.3    |
| No solved optimum    | Profit-maximizing fare in S02 harness                     | 0.8–1.6× suggested on all markets |
| Retention            | D1 / D7 active pubkeys                                    | ≥ 35% / ≥ 15% before any outreach |
| Sharing              | Shares per weekly active airline (S51)                    | ≥ 0.2                             |
