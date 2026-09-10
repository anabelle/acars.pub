# 🤖 AGENT ONBOARDING GUIDE (`AGENTS.md`)

Welcome to **ACARS**. If you are an AI System, Coding Assistant, or Autonomous Agent assigned to work on this repository, **READ THIS FILE FIRST**.

You are building the premier, open-source, decentralized real-world aviation simulation on the Nostr protocol.

## 1. The Spirit of ACARS

This is not a casual clicker game. This is a **massive, persistent, Wall Street-style corporate MMO** built to emulate the real world.

- **The Scale**: Millions of players trading tens of thousands of active flights.
- **The Engine**: 100% deterministic, mathematically pure, client-side evaluation.
- **The Ecosystem**: Real Bitcoin/Lightning monetization (Zaps, P2E prize pools, P2P Slot trading).

## 2. The Unbreakable Engineering Rules

### Rule 1: NO Central Database (Nostr Is The DB)

Do not try to add PostgreSQL, Redis, or Firebase. All game state is a deterministic reduction of a decentralized Nostr event log (NIP-33, kind: 30078, etc.). The client does the heavy lifting. If a player buys a plane, it is a signed event broadcast to relays.

### Rule 2: Strict 1:1 Real-Time Sync (UTC)

Time is not fast-forwarded. Game time maps 1:1 to real-world UTC time. 1 Game Tick = 3 seconds (`TICK_DURATION = 3000ms`), with 1,200 ticks per real-world hour (`TICKS_PER_HOUR = 1200`). If a flight takes 7 hours from JFK to LHR, it takes exactly 7 real-world hours to resolve. The game plays like a financial dashboard (or _Flightradar24_), generating a highly addictive "Idle/Check-in" loop.

### Rule 3: $O(1)$ Math Over $O(N^2)$ Loops

Because this scales to tens of thousands of flights, **you cannot simulate individual passengers**. If your code loops over every passenger, you failed. We use macro-economic formulas (Gravity Model for Demand, QSI for Market Share) that resolve instantly regardless of volume.

### Rule 4: Fixed-Point Arithmetic ONLY (`@acars/core/src/fixed-point.ts`)

Because state is calculated purely on the client side across different Javascript runtimes and architectures, floating-point drift ($\$10.01 + \$5.00 = \$15.0100000001$) will cause the networked state to desync and break the game. **Never use standard Javascript floats for money. You MUST use the `fp()` fixed-point utilities.**

### Rule 5: Virtualize The UI

You cannot render 10,000 aircraft rows into the DOM. Every list must use `@tanstack/react-virtual`. Every map uses WebGL instancing (MapLibre). If you add a list, ensure it scales to 1,000,000 rows without thrashing React.

## 3. The Corporate Architecture (First-Class Entities)

Be honest about what exists and what is planned. Both matter; conflating them breaks onboarding.

**PRESENT — the running model is 1:1 (Player = Airline).**

- Every player owns exactly one airline (`AirlineEntity`), created at identity setup with full assets and liabilities.
- The `AirlineEntity` type carries **vestigial corporate fields** (`sharesOutstanding: 10,000,000`, `shareholders: Record<pubkey, count>`) that are initialized to a single 100% owner and are otherwise unused today. Keep them in the type — the future model below builds on them — but do not write gameplay logic against multi-owner cap tables yet.
- **Chapter 11 bankruptcy is real and client-side**: the tick processor (engine slice) checks `corporateBalance < CHAPTER11_BALANCE_THRESHOLD_USD (-$10M)` each tick, grounds the fleet, pauses operations, and emits a bankruptcy `TICK_UPDATE`. There is no server, no arbiter, no transition to "liquidated".

**FUTURE — the Corporate Holding Model (PROPOSAL, Phase 8).**

- Multi-investor cap tables, IPOs, mergers, dividends, hostile takeovers via signed player vote events (kind `30081`), and automatic liquidation are **design only**. See `docs/CORPORATE_MODEL.md`, which is explicitly a proposal, not a spec of shipped behavior.
- Until that lands: _write types to support the `AirlineEntity` structure (so the migration path stays open), but implement gameplay against the 1:1 model._

## 4. Architecture Bounded Contexts

This repo is a strict Monorepo using `pnpm` workspaces. Do NOT mix concerns:

- `@acars/core`: Pure math, FixedPoint, zero dependencies. The authoritative state engine.
- `@acars/data`: Static catalogs (Airports, AircraftModels, Routes).
- `@acars/nostr`: The I/O layer. Reading/Writing signed events via NDK.
- `@acars/store`: Rehydration of the Nostr log into Zustand state memory for React.
- `@acars/map`: MapLibre GL globe and route visualization.
- `apps/web`: The UI.

## 5. Your Required Reading List

Before executing complex tasks or architecture decisions, use your tools to `view_file` the following:

1. `docs/DESIGN_PRINCIPLES.md` -> The gameplay vision, UI targets, and the O(1) constraints.
2. `docs/CORPORATE_MODEL.md` -> The Wall Street mechanics (M&A, Bankruptcy, Stocks).
3. `docs/ECONOMIC_MODEL.md` -> The math behind route demand, QSI, and Fixed-Point cost models.
4. `docs/MONETIZATION_MODEL.md` -> How the game generates real Bitcoin/Fiat via P2E and Zaps.
5. `docs/FLEET_MANAGER_PLAN.md` -> How aircraft depreciation, maintenance, and fleet commonality work.
6. `docs/AGENT_DEVELOPMENT_PARADIGM.md` -> The rules regarding branching, linting, testing, and Git commits.

## 6. Prime Directive

Every time you commit code, ask yourself: _"If 10,000 players fire this event simultaneously right now, will it break the math, melt the DOM, or desync the Nostr state?"_

If you understand the vision, you are cleared to build. Let's make history.
