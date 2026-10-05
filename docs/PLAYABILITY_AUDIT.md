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

### 2.7 UX/UI walkthrough (🟠 high)

Method: ran `apps/web` locally (Vite) and drove it with headless Chromium at 1440×900 and
390×844 as a guest, through "Play Free" up to the airline creator. Logged-in screens (Fleet,
Network, Corporate) were reviewed from code because airline creation needs a live relay.
Limitations: the sandbox blocked map tiles and Nostr relays, so the globe rendered black.
Treat map-specific visuals as unverified.

**U1 — The landing page promises features that don't exist.** `/join` sells "Issue stock,
manage a cap table, file for IPO … launch a hostile takeover", "Trade airline stock slots P2P"
and "Earn real Bitcoin". `AGENTS.md` and `CORPORATE_MODEL.md` say these are Phase 8
proposals. A player who arrives for Wall Street and finds turboprops shuttling between two
cities will call it dull. Sell what ships (live flights, real routes, rivals), and label the
rest "coming".

**U2 — The shell competes with itself on the entry page.** `/join` renders inside the full app
shell, which shows:

- three brand marks (top bar, join header, card);
- two sets of auth CTAs (the top bar's _Play Free / Browser wallet / I already have an nsec
  key / What is Nostr?_ plus the page's own _Play for free_);
- a breadcrumb that says **COCKPIT** on the join page;
- a sidebar of locked sections.

On mobile, the context bar (`COCKPIT · READ-ONLY MODE · ×`) **overlaps** the "Create Your
Airline" banner (`WorkspaceContextBar` vs the mobile top bar). Reproducible at 390 px on `/`,
`/?panel=cockpit` and `/join`.

**U3 — Guest home is an essay, not a world.** The first panel says "Start from the map / Let
the simulation breathe first", then sends you to the cockpit. As a guest, the cockpit is
instruction cards:

- "Use the map like an operator, not a tourist", "Study the board", "Launch when ready".
- At 1440 px the three cards squeeze into narrow columns that wrap one word per line, and
  the panel clips its own content.
- One "Launch your airline" tile is mostly empty space.

The world map should be the hero, with one CTA.

**U4 — Gated sections speak crypto.** Fleet, Planning and Finance show "_Network access
locked — open routes after you connect a Nostr wallet_", while the landing page promises "no
crypto knowledge needed". Better: let guests play a sandbox airline, and ask for identity
only when they want to keep it.

**U5 — The airline creator over-asks and mis-signals.**

- The badge reads **"Connected - create your airline"** as static text (`creator.connectedSubtitle`),
  even when every relay has failed.
- "You'll be flying in under a minute" heads a long form: hub, name, ICAO code, radio
  callsign, two colors, and key tools.
- The hub suggestion waits 15–30 s on "Finding your best starting hub…". It's derived from
  the browser time zone, so UTC users get Dakar (DSS).
- The hub card shows "Tier / Setup / Monthly" without saying why the choice matters for
  routes and demand.

**U6 — The status bar shows engine internals, and claims health it doesn't have.**

- "Game Time: **Cycle 16943913**" is a raw tick number; players need the UTC clock and "next
  landing in 12 min".
- "Economy 90.4%" (the prosperity index) reads like economy-class load.
- With every relay websocket failing, the ticker still showed a green **LIVE DATA** dot and
  "Status **Normal Operations**". Players get no signal that their actions may not be saved.

**U7 — The airport panel answers the wrong question.** For MAD it shows population, GDP per
capita, altitude, timezone, capacity per hour and slot control. Those are atlas facts. A player
clicking an airport wants to know: _is a route from my hub here worth it?_ That means
demand, projected load factor and profit per day, who already flies it, and a primary CTA. As a
guest, the primary CTA is "Set as Home" before an airline exists.

**U8 — Three vocabularies for six places.**

| Desktop sidebar | Mobile tab | URL            | Page title    |
| --------------- | ---------- | -------------- | ------------- |
| Cockpit         | OPS        | `/`            | Cockpit       |
| Fleet           | FLEET      | `/fleet`       | Fleet Manager |
| Planning        | PLAN       | `/network`     | Network       |
| Competition     | RIVALS     | `/leaderboard` | Leaderboard   |
| Finance         | CASH       | `/corporate`   | Corporate     |
| Briefing        | INFO       | `/about`       | About         |

Pick one name per place and use it everywhere.

**U9 — Planning screens show inputs, not outcomes.**

- The Opportunities tab sorts candidate destinations by distance and shows raw demand and
  cost per flight. Nobody wants to sort by distance; sort by projected profit per day.
- The fare editor has the same problem (§2.5).
- `RouteManager.tsx` has about 30 hard-coded English strings ("Monopoly Market: No active
  competitors…", "Est. Share", "Route Pricing", "Suggested fleet", "Cost split"), so the
  Spanish locale breaks on the most-used screen.

**U10 — Visual hierarchy is copy-first.** Almost every surface uses the same card recipe:
uppercase tracked kicker, bold title, explanatory paragraph. The numbers that drive decisions
(cash, profit per hour, load factor, tier progress) compete with prose. A financial-dashboard
game should be data-first:

- big numbers with deltas and sparklines;
- color only for state (red = losing money, amber = attention);
- explanations in tooltips or a first-run coach, not in permanent body copy.

**U11 — No juice.** The design bible's Mini Metro / Factorio targets ("the system _sings_")
aren't visible:

- landings don't show "+$8,662" floating over the airport;
- opening a route doesn't animate the arc drawing in;
- tier-up doesn't get a moment;
- audio (T-092/T-093) is deferred.

These cheap touches are what make a slow real-time game feel alive.

### 2.8 Graphics (🟠 high)

What's there today (`packages/map/src/Globe.tsx`, `apps/web/src/features/fleet`):

- A **flat Web-Mercator map**, not a globe. No `projection: "globe"` is set anywhere, even
  though the package, README and design bible all say "globe". MapLibre ≥ 5 supports globe
  projection natively.
- Carto **dark-matter / voyager** raster-style basemaps, plus a day/night terminator raster.
- Airports as flat `circle` layers, routes as flat `line` arcs, aircraft as 2D ADS-B-style
  `symbol` icons (tar1090 markers) with a glow circle.
- **AI-generated per-aircraft livery images** (`functions/api/generate-livery.ts`,
  `AircraftLiveryImage.tsx`). Nobody in the genre does this, and almost nobody sees it: it
  lives inside the fleet panel.
- An SVG family silhouette as the fallback for aircraft art.

Gaps against what players now expect:

| Area               | Today                                                                                                                              | State of the art (genre + "map as product" apps)                                                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| World              | Flat dark map, raster tiles                                                                                                        | 3D globe with atmosphere/fog, starfield at low zoom, smooth zoom from space to the airport. MapLibre ≥ 5 globe + sky gets most of the way at zero cost. |
| Routes             | Static 2D lines                                                                                                                    | Great-circle arcs that _rise_ off the globe, thickness by frequency, animated dash flow showing direction and traffic, colored by profit.               |
| Aircraft           | Same small icon for every type                                                                                                     | Icons scaled and shaped per family (turboprop / narrowbody / widebody), tinted in the airline livery, contrails, smooth interpolation.                  |
| Your airline       | Hub glow                                                                                                                           | Your network instantly recognizable in your livery colors; rivals in theirs; "my network" vs "world" toggle.                                            |
| Economy on the map | Nothing                                                                                                                            | Floating `+$` on landings, demand heatmap from your hub, pulsing airports with events, profit-colored routes.                                           |
| Identity art       | Livery images hidden in fleet details                                                                                              | Livery as the hero: hangar/gallery view, aircraft card on the route panel, shareable "fleet poster".                                                    |
| Regression safety  | None. The map was a **black canvas in production for ~13 days** (MapLibre 6 bump on 2026-09-10, fixed in `fc6b969` on 2026-09-23). | A Playwright smoke test in CI that boots the app, waits for map idle, and asserts non-blank canvas pixels and zero worker 404s.                         |

The map _is_ the product's screenshot, trailer and store listing. It's the single most
leveraged visual surface, and it currently looks like a monitoring dashboard rather than a
game.

### 2.9 Market & traction (🔴 critical)

**The genre is huge and proven.**

- **Airlines Manager: Plane Tycoon** (Playrion) claims 15M+ players. It offers a real-time
  "PRO" mode _and_ a fast "TYCOON" mode, and has an IATA data partnership.
- **Airline Manager 4** (Trophy Games) has 360+ aircraft and 3,600+ airports, an Easy and a
  Realism mode, alliances, and fuel/CO₂ market timing.
- Trophy Games' "Transport Game Series" (Airline, Truck and Farm Manager) made 67% of a
  record 2025 revenue. The studio reported **27M installs and 1.28M paying users** in 2025.
- Browser veterans AirlineSim and AirwaySim prove a hardcore real-time niche exists too.

**What ACARS really has that they don't.** Be precise here, because the leaders are _also_
persistent multiplayer worlds with real-time flights:

1. **No ads, no pay-to-win, no energy timers.** This is the #1 complaint in mobile-tycoon
   reviews.
2. **Open source + player-owned state** (Nostr). It's a story for a niche, not a hook for the
   mass market.
3. **A live-map spectacle tied to the real clock**: "my airline on Flightradar". This is the
   strongest _visual_ hook, and it's under-exploited (§2.8).
4. **AI liveries**: a unique, inherently shareable visual.

**Why traction is near zero.** It's not the concept:

| #   | Cause                                                                                                                                                                                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T1  | **Wrong front door.** The audience it speaks to is Nostr users: roughly 144k daily active pubkeys in late 2025, flat since. The audience that actually plays airline tycoons, aviation enthusiasts and Flightradar24/MSFS/AM4 players, is orders of magnitude larger and is greeted with "nsec key" and "What is Nostr?".                              |
| T2  | **No distribution surface.** Web-only SPA. There's an Android Capacitor scaffold, but no store listing is linked anywhere. No PWA manifest or service worker, so no install and no web push. The `<title>` is "ACARS - Corporate Console", with **no meta description and no Open Graph/Twitter card**, so every shared link previews as a blank card. |
| T3  | **No share loop.** Nothing a player can post: no route-map image, no livery card, no "my airline" public page, no milestone post to Nostr or X. The AI livery and the live map are natural share objects.                                                                                                                                              |
| T4  | **Broken first impressions.** The black map (§2.8), landing promises that don't exist (U1), flat economy (§2.1), and silent check-ins (§2.3). Even players who arrive bounce.                                                                                                                                                                          |
| T5  | **No measurement.** There's no analytics, so nobody can see where the funnel leaks. Nostr _is_ the analytics for the in-game part: `AIRLINE_CREATE` → first `ROUTE_OPEN` → first assignment → day-7 activity are all public, signed events. Only landing-page visits need a privacy-respecting counter.                                                |
| T6  | **No retention hooks to compound.** No push notifications, no streaks, no daily objectives. Organic growth needs D7 retention first. Spending on reach before fixing T4 leaks the bucket.                                                                                                                                                              |

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

### Phase A′: UI clarity pass (runs alongside A) · ~1–2 weeks

| #    | Change                                                                                                                                                                                                  | Fixes  |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| A′1  | **Honest landing page**: lead with live flights, real routes and rivals; move IPO/takeover/P2P/Bitcoin to a "Roadmap" strip.                                                                            | U1     |
| A′2  | **Dedicated entry layout** for `/join` and guests: no sidebar, one brand mark, one CTA ("Start your airline"), with key import as a small text link. Fix the mobile context-bar overlap.                | U2, U3 |
| A′3  | **Guest sandbox**: guests can open a route on a local-only demo airline. "Save your airline" creates the key and replays the actions. The locked-section copy loses "Nostr wallet".                     | U4     |
| A′4  | **Creator**: real connection state; suggest 3 hubs instantly with one-line reasons ("big domestic market", "cheap to open"); hide ICAO/callsign/colors behind "Customize" with auto-generated defaults. | U5     |
| A′5  | **Status bar**: UTC clock, next-landing countdown, cash delta today; rename "Economy" to "World economy"; tie the LIVE dot to real relay health (amber "offline – changes queued").                     | U6     |
| A′6  | **Airport panel as a decision card**: "From {hub}: 483 km · ~88% LF · +$24k/day · 0 rivals" and a primary **Launch route** CTA. Move atlas facts into a collapsed "Details" section.                    | U7     |
| A′7  | **One naming scheme** across sidebar, mobile tabs, URLs and titles (suggest: Cockpit, Fleet, Routes, Rivals, Finance, Info).                                                                            | U8     |
| A′8  | **Outcome-first planning**: sort Opportunities by projected profit per day by default; finish i18n of `RouteManager.tsx`.                                                                               | U9     |
| A′9  | **Data-first visual system**: KPI tiles with delta and sparkline; shrink kickers and body copy; move explanations into a dismissible first-run coach.                                                   | U10    |
| A′10 | **Juice pack**: floating revenue on landing (map + flight board), arc draw-in on route open, tier-up celebration, optional sounds.                                                                      | U11    |

**Success metric:** landing → creator completion rate; time to first route under 3 min on
mobile; zero hard-coded strings in `RouteManager.tsx` (lint rule).

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

### Phase E: "Make the map the trailer" (graphics) · ~2–4 weeks

| #   | Change                                                                                                                                                                                                               |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E0  | **Map smoke test in CI first**: Playwright boots the built app, waits for `idle`, asserts non-blank canvas pixels and no worker/style 404s. Without this, every item below can regress silently.                     |
| E1  | **Real globe**: `projection: { type: "globe" }` with sky/atmosphere and a fog horizon, globe at low zoom and Mercator when close. Fly-to on hub selection ("zoom from space to your hub" as the onboarding moment).  |
| E2  | **Living routes**: great-circle arcs colored by profit (green → red), width by weekly frequency, animated dash flow for direction. Rival routes thinner and in their livery color.                                   |
| E3  | **Aircraft identity on the map**: per-family icon set (turboprop, regional jet, narrowbody, widebody, A380/747), tinted with the airline's livery primary; short contrail trail; smooth interpolation between ticks. |
| E4  | **Economy on the map**: floating `+$8.6k` on landing, airport pulse for events and objectives, an opportunity heatmap from the selected hub (projected profit/day).                                                  |
| E5  | **Livery as hero**: hangar gallery, livery thumbnail in the route/aircraft panels and flight board, and a generated "fleet poster" image for sharing.                                                                |
| E6  | **Cinematic / spectator mode**: auto-camera that follows your busiest flights with a minimal HUD. It doubles as the landing-page hero, a stream overlay, and a screensaver-style check-in.                           |

Keep Rule 5 in mind: all of this stays WebGL-layer work (data-driven styling, instancing),
never DOM per aircraft.

### Phase F: Traction · runs after A/A′ ship, in parallel with B/C

| #   | Change                                                                                                                                                                                                                                                                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | **Position for aviation fans, not protocol fans**: "Run a real airline on the real clock. No ads. No pay-to-win." Nostr becomes the "your airline can't be taken away" footnote, not the gate.                                                                              |
| F2  | **Meta and shareability**: real `<title>`, description, OG/Twitter card with a live-map image; public `/airline/{npub}` pages with server-rendered OG images (Cloudflare Functions already exist) showing route map, livery and stats.                                      |
| F3  | **Share loop**: one-tap "share my network" image (map + livery + KPIs), milestone posts (first jet, tier-up) to Nostr kind 1 and X, and a referral link that gives both airlines a small hub-fee discount.                                                                  |
| F4  | **Installable + notifiable**: PWA manifest + service worker (install, web push for groundings/tier-ups/rival entry), then ship the existing Capacitor Android build to Google Play. Store presence is where AM4/Airlines Manager get their millions.                        |
| F5  | **Funnel metrics from Nostr**: a small dashboard counting creates → first route → first landing → D1/D7 active pubkeys, plus a cookie-less page-view counter. Review weekly; don't spend on reach until D7 is healthy.                                                      |
| F6  | **Seed the community where aviation people are**: r/aviation and r/flightsim showcases of the live map, a YouTube/TikTok timelapse of a network growing over a week, a Discord, and creator outreach to Airline Manager/flight-sim streamers ("ad-free alternative" angle). |
| F7  | **Optional fast "Tycoon" sandbox mode** (separate, non-ranked world with time ×N) for the first session, mirroring Airlines Manager's PRO/TYCOON split. The persistent 1:1 world stays canonical and ranked. This answers "I opened it and nothing happened".               |

**Success metric:** share-link CTR, organic signups/week, D7 retention ≥ 15% before any paid or
creator push.

---

## 4. Suggested Sequencing

1. **A1–A6 plus A′1, A′2, A′4, A′5 and A′6 first.** They're pure UI, low risk, and the biggest
   "feels complicated/cumbersome" wins. A′3 (guest sandbox) is the largest UI item; schedule
   it right after.
2. **B1 + B2 together**, behind one activation tick. These are the most important game-design
   changes; ship before the player base grows around the exploit.
3. **C1 + C4** next (cheap, big perceived improvement), then C2/C3/C6.
4. **E0 immediately** (it's small and protects everything), then E1–E3 alongside A/A′. A
   globe with profit-colored living routes is the screenshot that sells the game.
5. **F2, F4 and F5 as soon as A/A′ land**; F3/F6 once D7 retention is measured and healthy.
6. Phase D as the player base grows.

## Sources (market data, retrieved 2026-10-05)

- Trophy Games 2025 results (installs, paying users, Transport Game Series share):
  [inderes.se](https://www.inderes.se/en/releases/trophy-games-reports-record-year-for-2025-with-40percent-revenue-growth),
  [Q3 2025 update (PDF)](https://storage.mfn.se/b072df99-2239-4b70-8242-06cbd4635145/tg-q3-update-2025-final.pdf)
- Airline Manager 4: [Steam](https://store.steampowered.com/app/1641650/Airline_Manager/)
- Airlines Manager: Plane Tycoon (15M+ players, PRO/TYCOON modes): [App Store](https://apps.apple.com/app/id823481079)
- AirwaySim: [about](https://www.airwaysim.com/About)
- Nostr activity estimates: [glukhov.org overview](https://glukhov.org/post/2025/10/nostr-overview-and-statistics/)

## 5. Open Questions

- Is the 88% flat load factor on every route intentional "beginner-friendliness"? If yes, B1
  should still apply from Tier 2 upward.
- Is the oversupply curve (F4) deliberate saturation tuning?
- How should objective rewards be validated without an arbiter? Proposal: rewards are pure
  functions of the action log + date seed, so any client can recompute and reject invalid claims.
