# ACARS — Airline Tier Progression

## Overview

ACARS gates content through a **tier-based progression system**. Tiers advance automatically when you meet **both** the cumulative-revenue and active-route requirements (`packages/core/src/tier.ts`, `evaluateTier`). Higher tiers unlock longer routes, more hubs, and larger aircraft.

## Tier Requirements & Limits

|                        | Tier 1 — Regional Startup | Tier 2 — National Carrier | Tier 3 — Global Operator | Tier 4 — Legacy Giant |
| ---------------------- | ------------------------- | ------------------------- | ------------------------ | --------------------- |
| **Cumulative revenue** | — (start)                 | $5,000,000                | $50,000,000              | $250,000,000          |
| **Active routes**      | —                         | 3                         | 10                       | 25                    |
| **Max hubs**           | 1                         | 3                         | 5                        | Unlimited             |
| **Max route distance** | 3,000 km                  | 7,000 km                  | Unlimited                | Unlimited             |
| **Aircraft available** | 4                         | 21 (17 new)               | 30 (9 new)               | 35 (5 new)            |

Notes:

- Both conditions must be met simultaneously; satisfying only one holds you at the current tier.
- Airlines migrating from legacy saves are seeded with an estimated historic revenue via `estimateHistoricRevenue` (fleet purchase value + $2M per active route, capped at 25 routes).
- Tier 4 is the maximum tier (`MAX_TIER = 4`).

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
- Catalog: `packages/data/src/aircraft.ts` (35 models)

Last verified: 2026-09
