# AirTR

**Open-Source, Decentralized, Persistent Airline Management MMO on Nostr**

AirTR is a real-world aviation simulation where players build and operate virtual airlines competing on actual routes worldwide. Built for millions of concurrent players with a fully deterministic, client-side game engine backed by the decentralized Nostr protocol.

## Features

### Implemented
- **Deterministic Game Engine** — O(1) macro-economic formulas (Gravity Model, QSI) for route demand and market share
- **Fixed-Point Arithmetic** — No floating-point drift; all financial calculations are cross-platform deterministic
- **Nostr Integration** — Decentralized identity via NIP-07, airline state stored as signed events
- **Real Airport Data** — 14,000+ airports from OpenFlights with population, GDP, and seasonal tags
- **Interactive Globe** — MapLibre GL map with virtualized airport selection
- **Seasonal Demand** — Dynamic demand multipliers based on destination type and real-world date
- **Flight Economics** — Revenue, cost modeling (fuel, crew, maintenance, airport fees, navigation)

### Planned
- Fleet management with aircraft depreciation and maintenance
- Route scheduling and flight operations
- Real-time competition and multiplayer sync
- Corporate mechanics (IPO, M&A, stock trading, dividends)
- Alliance system with codeshares
- 3D CesiumJS cockpit view
- Procedural audio engine ("the music of your network")
- Bitcoin/Lightning monetization (Zaps, P2E pools)

## Architecture

```
                    ┌──────────────┐
                    │  apps/web    │  React 19 + Vite
                    │  (UI Layer)  │
                    └──────┬───────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ @airtr/map   │  │ @airtr/store │  │ @airtr/nostr │
│ MapLibre GL  │  │ Zustand      │  │ NDK Adapter  │
└──────────────┘  └──────┬───────┘  └──────┬───────┘
                         │                  │
                         ▼                  ▼
                  ┌──────────────┐  ┌──────────────┐
                  │ @airtr/core  │  │ @airtr/data  │
                  │ Pure Math    │  │ Static Data  │
                  │ Zero Deps    │  │ Airports     │
                  └──────────────┘  └──────────────┘
```

### Key Design Principles

1. **No Central Database** — All game state is a deterministic reduction of Nostr events
2. **1:1 Real-Time** — Game time equals UTC time; a 7-hour flight takes 7 real hours
3. **O(1) Math** — Macro-economic formulas instead of passenger-by-passenger simulation
4. **Fixed-Point Only** — Prevents floating-point desync across clients
5. **Virtualized UI** — All lists use `@tanstack/react-virtual` for scale

## Quick Start

### Prerequisites
- Node.js 20+
- pnpm 9+
- A NIP-07 browser extension (nos2x, Alby, or Nostr Connect)

### Installation

```bash
# Clone the repository
git clone https://github.com/anomalyco/airtr.git
cd airtr

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

Open http://localhost:5173 and connect your Nostr extension to create your airline.

### Available Scripts

```bash
pnpm dev          # Start web app in development mode
pnpm build        # Build all packages
pnpm test         # Run tests in watch mode
pnpm test:run     # Run tests once
pnpm lint         # Lint all packages
pnpm typecheck    # Type-check all packages
pnpm clean        # Remove all build artifacts
```

## Project Structure

```
airtr/
├── apps/
│   └── web/                 # React frontend
│       └── src/
│           ├── App.tsx      # Main application
│           └── components/  # UI components
├── packages/
│   ├── core/                # Pure game engine (zero dependencies)
│   │   └── src/
│   │       ├── fixed-point.ts   # Currency arithmetic
│   │       ├── demand.ts        # Gravity model
│   │       ├── qsi.ts           # Market share allocation
│   │       ├── finance.ts       # Revenue & costs
│   │       └── ...
│   ├── data/                # Static data catalogs
│   │   └── src/airports.ts  # Airport database
│   ├── map/                 # MapLibre GL components
│   ├── nostr/               # Nostr I/O layer
│   └── store/               # Zustand state management
├── docs/
│   ├── DESIGN_BIBLE.md      # Gameplay vision & UI targets
│   ├── ECONOMIC_MODEL.md    # Math behind demand, QSI, costs
│   ├── CORPORATE_MODEL.md   # Wall Street mechanics (M&A, IPOs)
│   ├── FLEET_MANAGER_PLAN.md    # Aircraft lifecycle
│   ├── MONETIZATION_MODEL.md    # Bitcoin/Lightning revenue
│   └── ROADMAP.md           # Development phases
└── AGENTS.md                # AI agent onboarding guide
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite, TypeScript |
| State | Zustand |
| Map | MapLibre GL |
| Virtualization | @tanstack/react-virtual |
| Networking | Nostr (NDK) |
| Identity | NIP-07 (nos2x, Alby) |
| Testing | Vitest |
| Package Manager | pnpm workspaces |

## Economic Model

### Demand Calculation (Gravity Model)

```
Demand = K × (Pop_A^α × Pop_B^β × GDP_A^γ × GDP_B^δ) / Distance^θ
```

Where:
- K = 6.4e-7 (calibrated against real BTS data)
- α, β = 0.8 (population exponents)
- γ = 0.6, δ = 0.3 (GDP exponents)
- θ = 1.2 (distance decay)

### Market Share (QSI)

Airlines compete on: price, frequency, travel time, stops, service quality, and brand reputation. Each factor is weighted differently for economy, business, and first-class passengers.

### Revenue & Costs

- **Revenue**: Ticket sales + ancillary ($20/pax)
- **Costs**: Fuel, crew, maintenance, airport fees, navigation, leasing, overhead

See `docs/ECONOMIC_MODEL.md` for full specification.

## Contributing

We welcome contributions! Please read:
- `AGENTS.md` — Engineering rules and constraints
- `docs/AGENT_DEVELOPMENT_PARADIGM.md` — Branching, linting, testing guidelines

### Development Constraints

Every feature must answer: *"If 10,000 players fire this event simultaneously, will it break the math, melt the DOM, or desync the Nostr state?"*

## Documentation

| Document | Purpose |
|----------|---------|
| [DESIGN_BIBLE.md](docs/DESIGN_BIBLE.md) | Gameplay vision, engagement loops, sensory design |
| [ECONOMIC_MODEL.md](docs/ECONOMIC_MODEL.md) | Gravity model, QSI, fixed-point costs |
| [CORPORATE_MODEL.md](docs/CORPORATE_MODEL.md) | IPOs, M&A, bankruptcy, stock mechanics |
| [FLEET_MANAGER_PLAN.md](docs/FLEET_MANAGER_PLAN.md) | Aircraft depreciation, maintenance, commonality |
| [MONETIZATION_MODEL.md](docs/MONETIZATION_MODEL.md) | Bitcoin/Lightning revenue streams |
| [ROADMAP.md](docs/ROADMAP.md) | Development phases and milestones |

## License

MIT

---

**The Prime Directive**: Every commit must respect the millions-scale constraint. No O(N²) loops. No floating-point money. No central database. The game state must be reproducible from the Nostr event log alone.
