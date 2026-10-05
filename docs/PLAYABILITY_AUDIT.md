# ACARS — Playability Audit & Improvement Plan

> Status: **audit + proposal** (October 2026). Nothing in this document is shipped behavior.
> Numbers below were produced by running the real `@acars/core` / `@acars/data` functions
> (`calculateDemand`, `scaleToAddressableMarket`, `allocatePassengers`, `calculateSupplyPressure`,
> `calculatePriceElasticity`, `calculateFlightRevenue`, `calculateFlightCost`) the same way
> `processFlightEngine` chains them for a solo player on a route.

---

## 1. Executive Summary

The engine is excellent: deterministic, fixed-point, O(1), replayable. The problem is not the
simulation's _correctness_; it is that **the simulation doesn't produce interesting decisions,
and the UI makes the few decisions that exist expensive to reach.**

The three complaints map to three root causes:

| Complaint       | Root cause                                                                                                                                                                                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Dull**        | Decisions don't matter. Every Tier-1 route runs at the same 88% load factor and the same ~$24k/day profit, whichever city you pick. There's nothing to react to between check-ins: no recap, no events, no goals, and progression gates sit weeks out.                         |
| **Complicated** | Onboarding front-loads protocol concepts (keys, ICAO, callsign, relays) before the player has done anything fun. The cockpit talks about "relay state" and "signed actions". Five top-level sections for what is essentially one loop.                                         |
| **Cumbersome**  | Getting the first plane airborne spans ~5 screens and 3 separate signed actions (open route → buy/lease → assign). The fare editor is three bare number inputs with a demand multiplier but no projected profit. Maintenance is a manual chore that silently grounds aircraft. |

The fix is a mix of **economy tuning in `@acars/core`** (so choices have consequences) and
**UX collapse in `apps/web`** (so choices are one click away), followed by a **check-in loop**
that gives a 1:1 real-time game something to say every time you open it.

---

## 2. Findings

### 2.1 Economy: choices are flat (🔴 critical)

**F1 — Every route is the same route.** A single aircraft can never exhaust a market:

| Route (ATR 72-600, suggested fares) | Addressable weekly demand | Weekly flights | Load factor | Op. profit / day |
| ----------------------------------- | ------------------------: | -------------: | ----------: | ---------------: |
| MAD–BCN (483 km)                    |                   140,100 |             23 |         88% |          $23,851 |
| MAD–LIS (513 km)                    |                    20,001 |             22 |         88% |          $23,799 |
| DEN–SLC (628 km)                    |                     3,155 |             19 |         88% |          $23,100 |
| JFK–BOS (300 km)                    |                   655,085 |             31 |         88% |          $25,572 |
| CCS–MAR (518 km)                    |                    12,261 |             22 |         88% |          $24,031 |

A 200× difference in market size produces a <10% difference in outcome. Route selection, the
core strategic act of an airline game, is effectively cosmetic. Cause: `PLAYER_MARKET_CEILING = 0.2`
of gravity demand is still orders of magnitude larger than one aircraft's weekly seats, so
`calculateSupplyPressure` always returns the `NATURAL_LF_CEILING` (0.88).

**F2 — Fare exploit on large markets.** For the same reason, price elasticity almost never
bites on big markets:

| MAD–BCN fare vs suggested | Load factor | Profit / leg |
| ------------------------: | ----------: | -----------: |
|                      1.0× |         88% |       $3,629 |
|                      2.0× |         88% |      $11,071 |
|                      5.0× |         88% |      $33,397 |
|                     10.0× |         88% |      $70,607 |
|                     40.0× |         73% |     $245,119 |

`MAX_FARE` is a flat $10,000 (`actionReducer.ts`, `networkSlice.ts`) regardless of distance. A
player who discovers this goes from ~$24k/day to ~$1.6M/day per turboprop, which breaks tier
pacing and the leaderboard. Thin markets (DEN–SLC) do punish it (LF 44% at 3×), which is the
behavior we want everywhere.

**F3 — Brand score rewards the exploit.** Brand only rises when average LF > 0.85
(`engineSlice.ts`). Price-gouging a big market keeps LF at 88%, so it _improves_ brand.

**F4 — Oversupply looks double-penalized.** Per-flight pax = `(weeklyAllocation / frequency) × pressure`.
Dividing by frequency already spreads demand across more flights; `calculateSupplyPressure`
then penalizes the same oversupply again. DEN–SLC with 10 ATRs gives ~4% LF where a naive
seats-vs-demand ratio gives ~24%. Players who over-assign see a cliff, not a curve. _Verify
intent before changing; this may be deliberate saturation tuning._

### 2.2 Pacing: the real-time clock has nothing to fill it (🔴 critical)

- Start: $100M cash (`identitySlice.ts`), hub open fee $250k–$5M, route slot $100k.
- 3 × ATR 72 on three routes ≈ **$176k revenue/day** → Tier 2 ($5M + 3 routes) in **~28 real days**.
- Tier 3 ($50M) at that fleet size ≈ **284 days**; reinvesting shortens it, but expansion is
  still measured in weeks of real time with no intermediate rewards.
- Leasing ($4k/day for an ATR 72) is strictly dominant over buying ($26M) for a new player.
  That isn't a decision; it's a trap for anyone who doesn't do the math.

Rule 2 (1:1 UTC) is a great idea, but real-time games survive on **short-horizon goals and
check-in payoffs** (Idle/Farm games, EVE skill queues, stock apps). ACARS has the long horizon
and lacks the short one.

### 2.3 Check-in loop: opening the app says nothing (🟠 high)

- No "while you were away" summary. The data exists (timeline, landings, P&L), but the
  player has to piece it together from the cockpit, the flight board and the corporate tab.
- No goals or objectives on screen. Tier progress is only visible inside `/corporate`.
- No world events beyond fuel price drift and seasons. The design bible's notification hooks
  (§2.2: "competitor opened a route on your turf", "route losing money") aren't surfaced as
  notifications.
- Achievements/badges (NIP-58, design bible §2.3) don't exist yet.
- Grounding (condition < 0.2 or > 600 h since check) happens silently while you're away; the
  first feedback is lost revenue.

### 2.4 Onboarding & first session (🟠 high)

- Creation asks for name, ICAO, callsign, two livery colors, hub, and (for ephemeral keys)
  key backup, all before the first fun moment. ICAO/callsign/colors can be auto-derived.
- Onboarding tutorial **T-091 is deferred** in `ROADMAP.md`; the cockpit's "actions" list is
  generic (`Tune network`, `Review finance`, `Scan competition`) rather than a guided next step.
- First flight path: Map/Network → pick destination → confirm route ($100k) → Fleet → Dealer →
  buy or lease → back to Fleet → pick route from a dropdown (aircraft must already be at an
  endpoint). That's about 5 screens and 3 signed actions for the core verb.

### 2.5 UI friction (🟡 medium)

- **Fare editor** (`RouteManager.tsx` ~L1800–1960): raw `<input type="number">` per class with
  an elasticity multiplier bar. It doesn't show what the player actually wants to know:
  _projected load factor, profit per flight, profit per day_. The labels ("Economy",
  "Suggested:", "Fare is … vs market") are hard-coded English despite the `es` locale.
- **Jargon in the main dashboard**: "Relay state", "signed actions should settle cleanly",
  "world tape". This is infrastructure status, so show it only when degraded.
- **Navigation**: Map / Fleet / Network / Leaderboard / Corporate plus About. Fleet and Network
  are two halves of one task (put planes on routes) but live on separate screens.
- **Very large components**: `RouteManager.tsx` (2,079 lines), `-corporate.lazy.tsx` (1,760),
  `FleetManager.tsx` (1,441). Not a player problem directly, but it slows every UX iteration
  below. Split as you touch them.

### 2.6 What's already strong (keep it)

- Real-time globe with live aircraft; the "Flightradar of my airline" fantasy lands.
- Cockpit already computes strongest/weakest route and idle-aircraft warnings; it just needs
  to lead with them.
- Deterministic PRNG, seasons, prosperity index and fuel model: everything needed for
  deterministic events and daily objectives already exists.
- Tier ladder with aircraft unlocks is a good spine; it needs closer rungs.

---

## 3. Improvement Plan

Guiding principle: **every check-in should surface a decision, and every decision should be
one click from where it's surfaced.**

> ⚠️ **Determinism note.** Any change to economic formulas in `@acars/core` alters replay
> results for existing action logs. Gate every economy change behind an activation tick (or
> `schemaVersion`) so ticks before activation replay with the old formula and checkpoints stay
> valid. Add determinism tests for both sides of the boundary.

### Phase A: "First Flight in 3 Minutes" (UX only, no economy changes) · ~1–2 weeks

| #   | Change                                                                                                                                                                                                                         | Where                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| A1  | **Quick-start creation**: name + hub only; auto-suggest ICAO/callsign/livery (editable later). Defer key backup to a banner after the first landing ("Secure your airline").                                                   | `AirlineCreator.tsx`, `SecurityUpgradeBanner.tsx` |
| A2  | **One-click route launch**: on airport click, show projected LF, profit/day and a recommended aircraft, then **"Open route + lease ATR 72 + assign"** as one button that publishes the 3 actions in sequence with one confirm. | `AirportInfoPanel.tsx`, new `useLaunchRoute` hook |
| A3  | **Guided first-hour checklist** (T-091) pinned in the cockpit: open first route → watch first takeoff → first landing → adjust a fare → open 3rd route (Tier 2 path). Each step deep-links.                                    | `OperationsCockpit.tsx`                           |
| A4  | **Tier progress bar in the Topbar** (revenue % + routes %), not just in Corporate.                                                                                                                                             | `Topbar.tsx`                                      |
| A5  | **Fare editor shows outcomes**: projected LF, profit/flight, profit/day for the current input, plus a "Suggested / Aggressive / Premium" preset row. i18n the hard-coded strings.                                              | `RouteManager.tsx` (extract `FareEditor.tsx`)     |
| A6  | **Hide infrastructure**: relay status becomes a small dot; it only gets a card when degraded. Rewrite cockpit copy in player language.                                                                                         | `OperationsCockpit.tsx`, `locales/*/game.json`    |
| A7  | **Assign from both sides**: "Add aircraft" on a route row and "Assign route" on an aircraft row; the list filters to aircraft at a valid endpoint and offers "ferry + assign" otherwise.                                       | `RouteManager.tsx`, `FleetManager.tsx`            |

**Success metric:** median time from landing on the site to first takeoff < 3 minutes; % of new
airlines with ≥1 assigned aircraft after first session > 80%.

### Phase B: "Make Decisions Matter" (economy, versioned) · ~2–3 weeks

| #   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | **Add a synthetic "incumbent carriers" offer to QSI.** Each market gets an NPC offer at the suggested fare with frequency scaled to market size (big markets = many incumbent flights). It's still O(1): one extra offer per route. Big markets become _contested_ (lower share, price matters); thin markets become _uncontested niches_ (high share, small volume). That fixes F1 and F2 at the root and makes route choice the core strategic act again. |
| B2  | **Distance-scaled fare ceiling** (e.g. 4× suggested) as a backstop, replacing the flat $10,000.                                                                                                                                                                                                                                                                                                                                                             |
| B3  | **Resolve the double oversupply penalty** (F4): apply either frequency-division or supply pressure, not both, so over-assignment degrades smoothly.                                                                                                                                                                                                                                                                                                         |
| B4  | **Brand score from service quality**: fare-vs-market fairness, on-time/maintenance state, and LF only within a healthy band. Price-gouging should cost brand.                                                                                                                                                                                                                                                                                               |
| B5  | **Make buy vs lease a real trade-off**: show payback period and total cost of ownership in the dealer; tune lease so it's cheaper short-term and buying wins after ~N months.                                                                                                                                                                                                                                                                               |
| B6  | **Route quality signals in the UI**: on route creation show "market size", "incumbent strength" and "your projected share". A map heat layer of opportunity from the hub is a strong follow-up.                                                                                                                                                                                                                                                             |

**Success metric:** spread of profit/day across a player's routes (we want variance); fewer than
5% of routes priced > 3× suggested; no single strategy dominates the top-10 leaderboard.

### Phase C: "Something Happened While You Were Away" (check-in loop) · ~2–3 weeks

| #   | Change                                                                                                                                                                                                                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | **Away report** modal on return (> 1 h absent): flights flown, pax, revenue/profit, best/worst route, groundings, tier progress delta, competitor moves on your routes. Built purely from the timeline + catch-up results.                                                   |
| C2  | **Daily objectives / charter contracts**, deterministically derived from the UTC date via the seeded PRNG so all clients agree (e.g. "Carry 2,000 pax into a beach airport this week: +$1.5M", "Open a route > 1,000 km"). Rewards are a signed claim validated client-side. |
| C3  | **Deterministic world events** seeded by tick: demand surges (festivals, sporting events), fuel shocks, hub congestion days, strikes. Shown as a ticker plus map pins, each with a clear "act now" opportunity.                                                              |
| C4  | **Auto-maintenance policy** per aircraft or fleet-wide ("service when condition < X% at a hub"). It removes the chore and keeps the cost decision.                                                                                                                           |
| C5  | **Notifications**: web push / Nostr DMs for grounding, tier-up, competitor entry, route turning unprofitable (the design bible §2.2 list).                                                                                                                                   |
| C6  | **Closer progression rungs**: add milestones between tiers (first $1M, 10k pax, first jet, 5 routes) with small cash/brand rewards and NIP-58 badges. Re-tune Tier 2 to be reachable in the first 1–3 days, and Tier 3 within ~3–4 weeks of active play.                     |

**Success metric:** D1 / D7 return rate; median check-ins per day; % of check-ins that result in
≥1 action (target > 50%).

### Phase D: Rivalry & depth · ongoing

- **Head-to-head route view**: when a competitor shares your route, show the QSI breakdown
  (fare, frequency, travel time, brand) and the lever that would win share back.
- **Seasonal leaderboards** (monthly resets on a profit-margin metric) so newcomers can win
  something; the all-time board stays for prestige.
- **Hub network effects**: connecting-passenger bonus for hub-and-spoke, so network shape
  matters as well as route count.
- Audio and polish from Phase 7 (T-092/T-093), now that there are moments worth sounding.

---

## 4. Suggested Sequencing

1. **A1–A6 first.** They're pure UI, low risk, and the biggest "feels cumbersome" wins.
2. **B1 + B2 together**, behind one activation tick. These are the most important game-design
   changes; ship before the player base grows around the exploit.
3. **C1 + C4** next (cheap, big perceived improvement), then C2/C3/C6.
4. Phase D as the player base grows.

## 5. Open Questions

- Is the 88% flat load factor on every route intentional "beginner-friendliness"? If yes, B1
  should still apply from Tier 2 upward.
- Is the oversupply curve (F4) deliberate saturation tuning?
- How should objective rewards be validated without an arbiter? Proposal: rewards are pure
  functions of the action log + date seed, so any client can recompute and reject invalid claims.
