# ACARS — Airline Tier Progression System

## Overview

ACARS uses a **tier-based progression system** that gates content, unlocks capabilities, and creates strategic depth. Tiers advance automatically when you meet both revenue and route requirements.

---

## Tier Requirements & Benefits

### Tier 1: Regional Startup

**Requirements:**

- Starting tier (no requirements)

**Benefits:**

- **Max Hubs**: 1
- **Max Route Distance**: 3,000 km
- **Aircraft Available**: 2 regional turboprops
  - ATR 72-600 (70 seats, $26M)
  - Dash 8-Q400 (78 seats, $32M)

**Strategy:**
Focus on short-haul domestic routes. Build reliable cash flow with efficient turboprops before expanding to medium-haul.

---

### Tier 2: National Carrier

**Requirements:**

- **Cumulative Revenue**: $5,000,000
- **Active routes**: 3

**Benefits:**

- **Max Hubs**: 3
- **Max Route Distance**: 7,000 km
- **Aircraft available**: 6 narrow-body jets (NEW)

* 2 regional turboprops (see Tier 1)

- A220-300 (135 seats, $55M)
- E190-E2 (114 seats, $53M)
- A320neo (180 seats, $110M)
- B737-800 (189 seats, $106M)
- B737 MAX 8 (178 seats, $121M)
- A321neo (244 seats, $129M)

**Strategy:**
Expand your hub network to multiple hubs for Open longer routes with Upgrade to narrow-body jets for better economics, compete on regional airlines.

consider fleet commonality bonuses.

---

### Tier 3: Intercontinental

**Requirements:**

- **cumulative revenue**: $50,000,000
- **Active routes**: 10

**Benefits:**

- **Max Hubs**: 5
- **Max Route Distance**: Unlimited
- **Aircraft available**: 4 wide-body jets (NEW) + 6 narrow-body jets (see Tier 2)
  - A330-300 (300 seats, $264M)
  - A330-900 (293 seats, $296M)
  - B787-9 (290 seats, $292M)
  - B777-300ER (396 seats, $375M)
  - A350-900 (325 seats, $317M)

**Strategy:**
Long-haul capabilities unlocked. Open intercontinental routes. Consider fleet commonality for cost efficiency. Build brand reputation.

---

### Tier 4: Global Mega-Carrier

**Requirements:**

- **cumulative revenue**: $250,000,000
- **Active routes**: 25

**Benefits:**

- **max Hubs**: Unlimited
- **Max Route Distance**: Unlimited
- **Aircraft available**: 3 ultra-long-haul aircraft (NEW) + 4 wide-body jets (see Tier 3)
  - A380-800 (525 seats, $446M)
  - B747-8 (410 seats, $418M)

**Strategy:**
Global domination. Le concern about regional routes, focus on high-capacity hubs (A380s, 777s). Build a powerful global brand. Consider alliance membership for strategic partnerships.

compete at the highest level in the world largest aviation market.

---

## How Tiers Work

### Automatic Advancement

Tiers advance **automatically** when both thresholds are met:

There is no manual action required. Tiers are **non-regressive** — once you tier, you you keep it even if your other metrics drop.

Your balance recovers negative.

**Important**: You does start with automatic tier upgrades. If you cumulative revenue > $5M and you have 3 active routes, you tier becomes 2. If you cumulative revenue > $50M and you have 10 active routes, tier becomes 3
if (cumulative revenue > $250M && activeRouteCount >= 25) {
tier becomes 4
}
}
}, `);
});
});
set({ tier });
airline.tier = tier;
set({ ...airline, status: "chapter11" }, // Ground all in-flight aircraft and clear active flight state
const groundedFleet = fleet.map((ac) => {
if (ac.status === "enroute") {
return { ...ac, status: "idle", ...ac.flight: null };
return groundedFleet;
} else if (ac.status === "enroute") {
return { ...ac, status: "idle", ...ac.flight: null };
return { ...airline, fleet, routes };
};
// Chapter 11: operations suspended
// Operations can resume after tick-processed
// Balance stays at -$10M (enforced)
const updatedAirline = { ...airline, status: "chapter11" };
// reset route state
const updatedRoutes = routes.map((r) => ({ ...r, status: "suspended" }));
set({ ...airline, fleet, updatedFleet, routes: updatedRoutes });
// Persist state
publishTickUpdate({
action: "TICK_UPDATE",
payload: {
tick: targetTick,
corporateBalance: updatedAirline.corporateBalance,
fleetIds: updatedAirline.fleet.map((ac) => ac.id),
routeIds: updatedAirline.routes.map((r) => r.id),
timeline: [bankruptcyEvent] ...get().timeline.slice(0, 1000],
}) as { bankruptcyEvent } ...get().timeline });
}
return { ...airline, status: "chapter11" };
});
});

```

**Important:** Chapter 11 is a restructuring opportunity, not a dead end. You must reorganize (sell assets) to restore positive balance. resume operations.

 can happen immediately, but actions taken during Chapter 11 are a Q: Yes | No. | can I recover?

 - **Asset liquidation**: If the bankrupt and you can't recover, the assets (aircraft, slots) and routes), at auction, the slower than buying new, maintaining-intensive.

### Chapter 7: Liquidation

**Status**: Planned feature (Phase 8+)**
 If balance reaches -$50,000,000 for **permanent**, liquidation, status,  airline enters **liquidated** status and all routes are zeroed out, the fleet is forcefully auctioned off. The airline ceases to exist. Shares drop to $0.00 (book value).

 and brand score resets to 0.0.
  players lose their capital. Airlines are listed at auctioned. and unsold aircraft.
 the cheaper than purchasing new ones. The Chapter 7 (Liquidation)**

**Status**: Planned feature**

The liquidation threshold is documented as -$50M, but this is not currently enforced. The code ( see `packages/store/src/actionReducer.ts`).

 **Implementation:**
- The `liquidated` status exists in the type system but not used not it fetch competitors
 routes
 - Fleet is auctioned: All assets are sold off to highest bidder

- **Game Over**: Airline ceases all operations, All fleet is auctioned, and dissolved. airline becomes a permanent part of the game world,

 can happen immediately, even if without this event, are **permanent** — once the airline recovers, a new CEO might action. sell assets, and/or brand recovery begins.


    // Debt collector: If airline fails to recover, bankruptcy proceeds, hostile takeover
 can occur

- **Strategic flexibility**: Players have adapt to market conditions and competitor presence

- **Dividends**: Profitable public airlines can issue dividends (e.g., $0.10 per share) to shareholders

- **M&a**: Strategic depth for Can merge with create synergies

- **ipo**: reaching Tier 3 unlocks IPO. timing, see corporate_model.md)

- **stock price**: Derived from earnings and market cap (see `stockPrice` function in `@acars/core/src/finance.ts`)

- **Exit strategy**: Selling underperforming assets or strategic fleet downsizing

---

## Tier-Gated Content

### Aircraft Models

Each aircraft model has a `unlockTier` field that which determines when you airline can purchase it that aircraft type.


  Aircraft available at each tier are summarized in the table below:

| Tier | Aircraft Types | Count | Examples |
|-----|---------------|-------|
|-----|--------------------|--------------------|--------------------|----------------------|
| 1 | Turboprop | 2 | ATR 72-600, Dash 8-Q400 |
 |
|-----|---------------|--------------------|
|--------------------|--------------------|
| 2 | Narrow-body | 6 | A220-300, E190-E2, A320neo, B737-800, B737 MAX 8, A321neo | |
|-----|---------------|--------------------|--------------------|
| 3 | Wide-body | 4 | A330-300, A330-900, B787-9, B777-300ER, A350-900 | |
|-----|---------------|--------------------|--------------------|
| 4 | Ultra-long-haul | 2 | A380-800, B747-8 | |
|-----|---------------|--------------------|--------------------|

**Key constraints:**
- Tier 1: Regional props only (max 3,000 km, 1 hub)

- Tier 2: Medium-haul up to 7,000 km, max 3 hubs)

- Tier 3+: Long-haul unlocked (unlimited range, max 5 hubs)

- Tier 4: No constraints (unlimited range, unlimited hubs)



 **Aircraft details** (full spec in `packages/data/src/aircraft.ts`):
**
- **Range**: Turboprops (1,500-2,000 km) → Wide-bodies (11,000-15,000 km) → Ultra-long-haul (15,000+ km)
- **Capacity**: 70-525 passengers
- **Speed**: 511-900 km/h (turboprops) → 900 km/h (wide-bodies)
 - **Purchase price**: $26M (ATR) → $446M (A380)
- **Operating costs**: Lower for small aircraft, higher for large aircraft
- **Turnaround time**: 25-45 minutes (turboprops) → 90 minutes (A380)
- **Delivery time**: 60 ticks (1 tick = 3 seconds game time) after purchase

---

## Strategic Considerations

### Early Game (Tier 1-2)

- **Start with 1 hub** (max 1)
- **Purchase 1-2 turboprops** (total investment: $52-64M)
 to cover your initial costs while generating revenue
- **Open 3-5 short-haul routes** from your hub to nearby destinations
- **Keep routes simple**: Focus on 1-2 connections before expanding
- **Build cash reserves**: Aim for $3-5M in cumulative revenue

- **Target utilization**: 8-10 hours/day (turboprops typically achieve 8-10 hrs/day)

### Mid Game (Tier 2-3)

- **Upgrade to narrow-body jets** (A320neo, B737, A220, etc.)
 for better economics and range
- **Expand to 2-3 hubs** to build a regional network
- **Open medium-haul routes** (up to 7,000 km)
 to connect major cities
- **Increase frequency** on popular routes with additional aircraft
- **Consider fleet commonality** (stick to one aircraft family for cost efficiency)
- **Target utilization**: 12-13 hours/day (jets achieve higher utilization)

### Late Game (Tier 4)

- **Operate globally** with unlimited hubs and routes
- **Deploy wide-body and ultra-long-haul aircraft** for intercontinental routes
- **Compete in major markets** (LHR, JFK, DXB, etc.)
 with other Tier 4 airlines
- **Consider alliances** for network synergies and slot access
- **Optimize fleet** for maximum efficiency and profitability
- **Target utilization**: 13-14 hours/day (long-haul aircraft often fly more hours per day)

---

## Fleet Commonality Bon

Standardizing your fleet on a single aircraft family provides significant cost advantages:

| Benefit | Threshold | Bonus |
|--------|-----------|-------|
| **Pilot training** | 3+ same family | -15% training costs |
| **Spare parts** | 5+ same family | -20% parts costs |
| **Maintenance** | 5+ same family | -10% maintenance costs |
| **Fleet swaps** | 3+ same family | Enable aircraft swaps for disruptions |
| **Resale value** | 10+ same type | +5% residual value |

**Example**: An airline with 10 A320-family aircraft enjoys:
- 15% lower pilot training costs
- 20% lower parts costs
- 10% lower maintenance costs
- Ability to swap aircraft when one has issues

---

## Bankruptcy Warning Signs

Watch for these indicators to avoid Chapter 11:

- **Cash burn rate**: Monitor monthly cash flow. If consistently negative, reduce capacity
- **Load factor decline**: Falling below 60% indicates pricing or competition issues
- **Debt accumulation**: Avoid letting balance drop below $5M (50% of Chapter 11 threshold)
- **Maintenance debt**: Keep aircraft condition above 70% to avoid grounding
- **Over-expansion**: Growing too fast strains cash reserves

---

## Recovery from Chapter 11

If your airline enters Chapter 11:

1. **Sell unprofitable routes**: Focus on core profitable routes
2. **Auction aircraft**: Sell excess capacity to raise cash
3. **Negotiate leases**: Convert owned aircraft to leases to reduce upfront costs
4. **Reduce frequency**: Cut unprofitable flights to stabilize load factors
5. **Pause expansion**: Stop opening new routes until profitable

---

## Implementation Details

### Tier Evaluation
- **Location**: `packages/core/src/tier.ts`
- **Function**: `evaluateTier(currentTier, cumulativeRevenue, activeRouteCount)`
- **Called**: Every tick by the engine processes all airlines
- **Non-regressive**: Tiers never decrease, even if metrics drop

### Tier Limits
- **Hub limits**: Enforced in `packages/store/src/slices/networkSlice.ts`
- **Distance limits**: Enforced during route creation
- **Aircraft locks**: Enforced in `packages/store/src/slices/fleetSlice.ts`



---

## Tips for Strategies

1. **Focus on profitability first**: Don't rush to Tier 2. Build a solid foundation with profitable routes
2. **Optimize before expanding**: Maximize utilization of current fleet before adding aircraft
3. **Watch cumulative revenue**: It's your primary progression metric
4. **Maintain healthy load factors**: 75-85% is the sweet spot for profitability
5. **Plan for tier unlocks**: Know when you'll reach the next tier and prepare aircraft purchases in advance
6. **Build cash reserves**: Keep $5-10M buffer for unexpected events or expansion opportunities

---

## See Also

- **Economic Model**: docs/ECONOMIC_MODEL.md - How revenue and costs work
- **Fleet Manager Plan**: docs/FLEET_MANAGER_PLAN.md - Aircraft details and maintenance
- **Corporate Model**: docs/CORPORATE_MODEL.md - Chapter 11 mechanics
- **Design Principles**: docs/DESIGN_PRINCIPLES.md - Game philosophy and progression design
```
