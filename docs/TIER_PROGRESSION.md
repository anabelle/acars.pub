# ACARS — Airline Tier Progression

## Overview

ACARS gates content through a **tier-based progression system**. Tiers advance automatically when you meet **both** the cumulative-revenue and active-route requirements (`packages/core/src/tier.ts`, `evaluateTier`). Higher tiers unlock longer routes, more hubs, and larger aircraft.

## Tier Requirements & Limits

|                        | Tier 1 — Regional Startup | Tier 2 — National Carrier | Tier 3 — Global Operator | Tier 4 — Legacy Giant |
| ---------------------- | ------------------------- | ------------------------- | ------------------------ | --------------------- |
| **Cumulative revenue** | — (start)                 | $1,000,000                | $10,000,000              | $60,000,000           |
| **Active routes**      | —                         | 3                         | 10                       | 25                    |
| **Max hubs**           | 1                         | 3                         | 5                        | Unlimited             |
| **Max route distance** | 3,000 km                  | 7,000 km                  | Unlimited                | Unlimited             |
| **Aircraft available** | 4                         | 21 (17 new)               | 30 (9 new)               | 35 (5 new)            |

Notes:

- Both conditions must be met simultaneously; satisfying only one holds you at the current tier.
- Airlines migrating from legacy saves are seeded with an estimated historic revenue via `estimateHistoricRevenue` (fleet purchase value + $2M per active route, capped at 25 routes).
- Tier 4 is the maximum tier (`MAX_TIER = 4`).

## Pacing

Thresholds are tuned with the balance harness (`pnpm balance`, report §5), which runs day-one strategies from a MAD hub with $100M through the real flight engine:

| Strategy                                     | Fleet     | Tier 2 |          Tier 3 |
| -------------------------------------------- | --------- | -----: | --------------: |
| Cautious: 3 ATR 72s at suggested fares       | 3 leased  | day 11 | needs 10 routes |
| Balanced: 10 ATR 72s at 1.2× fares           | 10 leased |  day 3 |          day 28 |
| Greedy: every ATR 72 the cash allows at 1.4× | 15 leased |  day 3 |          day 21 |

Targets: a balanced player reaches Tier 2 in 1–3 days and Tier 3 in 3–4 weeks, and the greedy path is never more than 2× faster (`packages/store/src/balance/report.test.ts`). Tier 4's 25 routes call for growing the network, not a day-one fleet.

## Milestones

Between tiers, `MILESTONES` (`packages/core/src/milestones.ts`) gives 16 smaller rungs, such as first route, $250k revenue, 3 / 5 / 10 routes, first owned aircraft, first jet, second hub, brand 0.7, first widebody, fleet of 25, and revenue rungs up to $100M. Each is a target on one metric of airline state, with a $100k–$2M reward. The evaluators are pure (`milestoneState`, `isMilestoneMet`, `milestoneProgress`, `newlyMetMilestones`, `nextMilestones`). Rewards are not credited in-game yet (S12 follow-up).

## Leasing vs buying

Every lease is priced from the aircraft price (`packages/core/src/fleet.ts`):

- **Deposit:** 25% of the price (`LEASE_DEPOSIT_SHARE`), paid up front and not refunded.
- **Monthly payment:** 0.6% of the price (`LEASE_MONTHLY_RATE`), e.g. ATR 72-600 $156k, A320neo $660k.
- **Selling an owned aircraft:** returns 70% of its book value (`SCRAP_RESALE_SHARE`). Book value depreciates 10% a year, continuously, floored at the model's residual value.

Leasing is the cheaper way to start, and buying works out cheaper from month 49 (about 4 years) for every model (`leaseBuyBreakEvenMonths`; the dealer shows it). On day one, $100M leases about 15 ATR 72s.

## Aircraft Catalog by Tier

### Tier 1: Regional Startup — 4 models

Regional turboprops. Short domestic routes only.

| Model       | Type      | Seats | Price |    Range | Cruise speed |
| ----------- | --------- | ----: | ----: | -------: | -----------: |
| ATR 42-600  | Turboprop |    48 |  $21M | 1,326 km |     556 km/h |
| Dash 8-300  | Turboprop |    50 |  $22M | 1,558 km |     528 km/h |
| ATR 72-600  | Turboprop |    70 |  $26M | 1,528 km |     511 km/h |
| Dash 8-Q400 | Turboprop |    78 |  $32M | 2,037 km |     667 km/h |

**Strategy:** build reliable short-haul cash flow before expanding to medium-haul.

### Tier 2: National Carrier — 17 new models

Regional jets and narrowbodies. Continental routes up to 7,000 km.

| Model     | Type         | Seats | Price |    Range | Cruise speed |
| --------- | ------------ | ----: | ----: | -------: | -----------: |
| E170      | Regional jet |    70 |  $43M | 3,889 km |     851 km/h |
| E175      | Regional jet |    76 |  $47M | 3,706 km |     871 km/h |
| A220-100  | Regional jet |   112 |  $49M | 6,390 km |     871 km/h |
| E190      | Regional jet |   100 |  $50M | 4,537 km |     871 km/h |
| E190-E2   | Regional jet |   114 |  $53M | 5,300 km |     871 km/h |
| A220-300  | Regional jet |   135 |  $55M | 6,300 km |     871 km/h |
| E195-E2   | Regional jet |   136 |  $60M | 4,815 km |     870 km/h |
| 737-700   | Narrowbody   |   138 |  $90M | 6,230 km |     852 km/h |
| A320-200  | Narrowbody   |   162 |  $98M | 6,150 km |     828 km/h |
| A319neo   | Narrowbody   |   138 | $101M | 6,850 km |     828 km/h |
| 737-800   | Narrowbody   |   189 | $106M | 5,765 km |     852 km/h |
| A320neo   | Narrowbody   |   180 | $110M | 6,300 km |     903 km/h |
| 737-900ER | Narrowbody   |   197 | $114M | 5,925 km |     852 km/h |
| 737 MAX 8 | Narrowbody   |   178 | $121M | 6,570 km |     839 km/h |
| 737 MAX 9 | Narrowbody   |   188 | $128M | 6,570 km |     839 km/h |
| A321neo   | Narrowbody   |   244 | $129M | 7,400 km |     876 km/h |
| A321LR    | Narrowbody   |   200 | $135M | 8,150 km |     876 km/h |

**Strategy:** transition to jets, open secondary hubs, and grow the route count toward the Tier 3 threshold. Mind fleet-commonality bonuses.

### Tier 3: Global Operator — 9 new models

Widebodies enter the fleet. Route distance is no longer limited; intercontinental routes become viable.

| Model             | Type       | Seats | Price |     Range | Cruise speed |
| ----------------- | ---------- | ----: | ----: | --------: | -----------: |
| A321XLR           | Narrowbody |   188 | $145M |  8,700 km |     876 km/h |
| A330-200          | Widebody   |   240 | $238M | 13,450 km |     871 km/h |
| 787-8 Dreamliner  | Widebody   |   248 | $248M | 13,530 km |     903 km/h |
| A330-300          | Widebody   |   300 | $264M | 11,750 km |     871 km/h |
| 787-9 Dreamliner  | Widebody   |   290 | $292M | 14,140 km |     903 km/h |
| A330-900          | Widebody   |   293 | $296M | 13,300 km |     871 km/h |
| 777-200ER         | Widebody   |   298 | $306M | 14,305 km |     905 km/h |
| 787-10 Dreamliner | Widebody   |   326 | $338M | 11,910 km |     903 km/h |
| 777-300ER         | Widebody   |   364 | $375M | 13,650 km |     905 km/h |

**Strategy:** long-haul premium cabins dominate revenue. Build brand reputation and scale toward 25 active routes for Tier 4.

### Tier 4: Legacy Giant — 5 new models

The largest long-haul aircraft in the catalog.

| Model     | Type     | Seats | Price |     Range | Cruise speed |
| --------- | -------- | ----: | ----: | --------: | -----------: |
| A350-900  | Widebody |   320 | $317M | 15,000 km |     903 km/h |
| 777-200LR | Widebody |   276 | $346M | 15,840 km |     905 km/h |
| A350-1000 | Widebody |   344 | $366M | 16,100 km |     903 km/h |
| 747-8     | Widebody |   426 | $418M | 15,000 km |     917 km/h |
| A380-800  | Widebody |   525 | $445M | 15,200 km |     903 km/h |

**Strategy:** high-capacity hub operations. Focus on the thickest long-haul markets and fleet commonality at scale.

## Source of Truth

- Thresholds and limits: `packages/core/src/tier.ts` (`TIER_THRESHOLDS`, `getMaxRouteDistanceKm`, `getMaxHubs`)
- Catalog: `packages/data/src/aircraft.ts` (35 models; `monthlyLease` derived from price)
- Lease and buy: `packages/core/src/fleet.ts` (`LEASE_DEPOSIT_SHARE`, `LEASE_MONTHLY_RATE`, `SCRAP_RESALE_SHARE`, `ownershipCost`, `leaseBuyBreakEvenMonths`)
- Milestones: `packages/core/src/milestones.ts`
- Pacing evidence: `docs/overhaul/balance/latest.md` §5

Last verified: 2026-10
