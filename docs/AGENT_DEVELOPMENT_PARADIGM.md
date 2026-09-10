# ACARS — Agent-Collaborative Development Paradigm (ACDP)

## A Safe, Scalable, and Fail-Safe System for AI Agents to Build Software Together

---

## The Problem

Multiple AI agents working on the same codebase will:

- **Stomp on each other's files** if working concurrently without coordination
- **Break contracts** between packages if they don't understand boundaries
- **Introduce regressions** if there's no automated verification
- **Diverge in style/approach** without shared standards
- **Cascade failures** — one agent's mistake poisons another agent's context
- **Lose context** across conversations, leading to contradictory decisions

We need a paradigm that makes **agent collaboration as safe as git makes human collaboration** — but adapted for how agents actually work (no meetings, no Slack, pure async, context-limited).

---

## Table of Contents

1. [Core Principles](#1-core-principles)
2. [The Ownership Model](#2-the-ownership-model)
3. [The Contract System](#3-the-contract-system)
4. [What Actually Exists: The Gate Scripts](#4-what-actually-exists-the-gate-scripts)
5. [The CI Pipeline](#5-the-ci-pipeline)
6. [Not Yet Implemented](#6-not-yet-implemented)

---

## 1. Core Principles

### 1.1 The Five Laws of Agent Development

```
LAW 1: BOUNDED OWNERSHIP
  Every file, directory, and module has exactly ONE owner at any time.
  An agent may only modify files within its owned boundary.
  Ownership is explicit, tracked, and transferable.

LAW 2: CONTRACT-FIRST
  All cross-boundary communication is through typed interfaces.
  Interfaces are defined BEFORE implementation.
  An agent can NEVER break a published contract.
  Contracts can only be evolved through a formal deprecation process.

LAW 3: VERIFY-BEFORE-MERGE
  No agent output reaches the trunk without passing ALL gates.
  Gates are automated, deterministic, and fast.
  A failing gate is an absolute veto — no exceptions, no overrides by agents.

LAW 4: FAIL-SAFE DEFAULTS
  If an agent crashes, times out, or produces invalid output,
  the system reverts to the last known-good state.
  No partial work is ever committed to trunk.
  Every operation is atomic — it either fully succeeds or fully rolls back.

LAW 5: KNOWLEDGE FLOWS DOWN, NEVER SIDEWAYS
  Agents don't communicate with each other directly.
  All coordination flows through shared artifacts:
  contracts, docs, task queue, and the codebase itself.
  This prevents the "telephone game" failure mode.
```

### 1.2 Why These Laws Exist

| Law                  | Without It                                                                   | With It                                       |
| -------------------- | ---------------------------------------------------------------------------- | --------------------------------------------- |
| Bounded Ownership    | Two agents edit the same file → merge conflict → corruption                  | Clean parallel work, zero conflicts           |
| Contract-First       | Agent A changes a function signature → Agent B's code breaks                 | Both agents code against stable interfaces    |
| Verify-Before-Merge  | Bad code reaches trunk → poisons every other agent's context                 | Trunk is always green, always correct         |
| Fail-Safe Defaults   | Agent crashes mid-edit → half-written file → cascading breakage              | Atomic rollback, system self-heals            |
| Knowledge Flows Down | Agent A tells Agent B "I changed the API" but gets it wrong → silent failure | Single source of truth (the code + contracts) |

---

## 2. The Ownership Model

### 2.1 Bounded Contexts as Ownership Zones

Each package in the monorepo is a **bounded context** with a single owner:

```
acars/
├── packages/
│   ├── @acars/core          ← ZONE: "core"
│   │   ├── OWNERS.md        ← Declares who can modify this zone
│   │   ├── CONTRACT.md      ← Public API contract
│   │   └── ...
│   │
│   ├── @acars/data          ← ZONE: "data"
│   ├── @acars/nostr         ← ZONE: "nostr"
│   ├── @acars/map           ← ZONE: "map"
│   └── @acars/store         ← ZONE: "store"
│
├── apps/
│   └── web/                 ← ZONE: "app"
│
└── docs/                    ← ZONE: "docs"
```

> **Note**: The Design Bible describes additional planned packages (`@acars/ui`, `@acars/3d`, `@acars/audio`, `@acars/i18n`) that have not yet been created. When they are implemented, they will become additional ownership zones.

### 2.2 OWNERS.md Format

Each zone has an `OWNERS.md` file at its root:

```markdown
# @acars/core — Ownership Record

## Current Owner

- **Agent**: agent-core-v1
- **Since**: 2026-02-20T20:30:00Z
- **Task**: TASK-007 (Implement gravity demand model)

## Ownership Rules

- Only the listed agent may create, modify, or delete files in this zone.
- Ownership is acquired by claiming a task that targets this zone.
- Ownership is released when the task is completed and merged.
- The human operator can override ownership at any time.

## Read-Only Access

All agents may READ files in this zone at any time.
Reading never requires ownership.

## Dependencies (zones this zone imports from)

- @acars/data (read-only: airport data types)

## Dependents (zones that import from this zone)

- @acars/store
- @acars/nostr
```

### 2.3 Ownership Lifecycle

```
AVAILABLE → CLAIMED → ACTIVE → REVIEW → MERGED → AVAILABLE
    │           │        │         │         │
    │           │        │         │         └─ Zone is released
    │           │        │         └─ Gates running, agent waits
    │           │        └─ Agent is actively modifying files
    │           └─ Agent has lock, sets up branch
    └─ No agent owns this zone
```

**Key constraint**: An agent can own **at most 2 zones simultaneously** (to prevent one agent from monopolizing the codebase). For cross-zone work, use the Task Protocol (Section 5).

---

## 3. The Contract System

### 3.1 Why Contracts Are the Backbone

In multi-agent development, **contracts replace communication**. Instead of agents "talking" to each other about interfaces, they read and write formal contracts. This eliminates misunderstanding, ambiguity, and the telephone game.

### 3.2 CONTRACT.md Format

Every zone publishes a `CONTRACT.md` that specifies its public API:

````markdown
# @acars/core — Public API Contract

## Version: 1.0.0

## Status: STABLE

### Exported Types

```typescript
// Airport
interface Airport {
  id: string; // OpenFlights ID
  name: string; // Airport name (English)
  iata: string; // 3-letter IATA code
  icao: string; // 4-letter ICAO code
  latitude: number; // Decimal degrees
  longitude: number; // Decimal degrees
  altitude: number; // Feet above sea level
  timezone: string; // IANA timezone
  country: string; // ISO 3166-1 alpha-2
}

// DemandResult
interface DemandResult {
  origin: string; // IATA code
  destination: string; // IATA code
  economy: number; // Weekly pax demand
  business: number; // Weekly pax demand
  first: number; // Weekly pax demand
}
```
````

### Exported Functions

```typescript
// Calculate demand between two airports
function calculateDemand(
  origin: Airport,
  destination: Airport,
  season: Season,
  prosperityIndex: number,
): DemandResult;

// Calculate QSI for a flight
function calculateQSI(
  flight: FlightOffer,
  competitors: FlightOffer[],
  passengerClass: "economy" | "business" | "first",
): number;
```

### Contract Rules

1. All exports listed above are FROZEN until a major version bump.
2. New exports may be ADDED without a version bump.
3. Existing exports may NOT be modified or removed without:
   a. A deprecation notice in this file
   b. A migration guide
   c. A major version bump (1.x → 2.0)
   d. Human operator approval

````

### 3.3 Contract Verification (Current State: Existence Check Only)

`scripts/gates/contract-check.sh` currently verifies only that every zone has
a `CONTRACT.md` file. It does **not** diff actual TypeScript exports against
the documented API. **Export verification is planned** — until it exists, the
contract files are kept in sync manually (each carries a "Last verified" date),
and an agent that changes a public export must update its zone's CONTRACT.md
in the same change.

### 3.4 Contract Evolution Protocol

When an agent needs to change a contract:

```
1. Agent creates a PROPOSAL file:
   packages/@acars/core/PROPOSALS/002-add-cargo-demand.md

2. Proposal includes:
   - What changes
   - Why it's needed
   - Migration path for dependents
   - Backward compatibility analysis

3. Human operator reviews and approves/rejects
   (This is the ONE human-in-the-loop moment)

4. If approved:
   - CONTRACT.md is updated
   - Dependent zones are notified via task queue
   - A migration task is auto-created for each dependent
```

---

## 4. What Actually Exists: The Gate Scripts

The gate pipeline lives in `scripts/gates/` — eight small bash scripts, run in
sequence by `run-all.sh`. They are thin wrappers around pnpm workspace
commands, **not** an orchestration system:

| Script | What it really does |
|---|---|
| `lint.sh` (Gate 1) | `pnpm lint` — ESLint across all packages |
| `typecheck.sh` (Gate 2) | `pnpm typecheck` — `tsc --noEmit` per package |
| `unit-test.sh` (Gate 3) | `pnpm test` — Vitest across all packages |
| `contract-check.sh` (Gate 4) | Checks that each zone **has a** `CONTRACT.md`. Export verification is planned; today the check is existence-only |
| `boundary-check.sh` (Gate 5) | Prints changed files vs main. **Informational only** — no OWNERS.md parsing, no enforcement |
| `integration-test.sh` (Gate 6) | Cross-zone tests (workspace test run) |
| `build-check.sh` (Gate 7) | `pnpm build` — production build |
| `determinism-check.sh` (Gate 8) | Runs `@acars/core` tests (PRNG, fixed-point, QSI determinism suites) |

What this means in practice:

- Gates fail loudly (any non-zero exit stops `run-all.sh`), but nothing
  **forces** an agent to run them before pushing — CI is the real enforcement
  point (Section 5).
- There is no auto-merge, no retry counter, no feedback-file writer. "Gate
  failed" simply means: the script exited non-zero, read its output.
- Boundary enforcement is a human/agent discipline backed by OWNERS.md, not
  machine-checked (yet).

## 5. The CI Pipeline

`.github/workflows/ci.yml` is the authoritative, non-bypassable gate. On every
PR and push to `main` it runs:

1. `pnpm install --frozen-lockfile`
2. `pnpm run build` — production build
3. `pnpm run lint`
4. `pnpm run typecheck` — workspace packages
5. `pnpm run typecheck:functions` — Cloudflare Pages Functions (`functions/`)
6. `pnpm run test:coverage` — every package's Vitest suite with
   `--coverage.enabled` and thresholds enforced (`autoUpdate=false`); packages
   without configured thresholds run coverage ungated
7. `pnpm audit --prod --audit-level=high` — dependency vulnerability gate

## 6. Not Yet Implemented

Earlier revisions of this document described infrastructure that does not
exist. To be explicit, the following are **design ideas, not code**:

- Task queue / `.agent/` directory tree (backlog/active/review/done/failed)
- Auto-merge of passing branches; retry counters and gate-failure feedback files
- Dashboard visualization of zones/agents/pipeline
- Dead man's switch (auto-release of stale zone ownership)
- Blast-radius limiter (max diff size per task)
- Post-merge smoke test with automatic trunk revert
- Contract export verification (Gate 4 is existence-only — see §3.3)
- Boundary enforcement via OWNERS.md parsing (Gate 5 is informational)

If you are an agent reading this: coordinate through the human operator and
the file tree (OWNERS.md, CONTRACT.md, docs/), verify locally with
`scripts/gates/run-all.sh`, and let CI be the final judge.

---

## Summary: The ACDP Promise

| Property               | How ACDP Delivers It Today                                                                                          |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Safe**              | Zone ownership via OWNERS.md (convention) + CI that must pass before merge.                                          |
| **Scalable**          | N agents work in parallel on N zones; the gate scripts and CI apply uniformly.                                       |
| **Fail-Safe**         | CI gates fail loudly; trunk stays green because merges require a green pipeline.                                     |
| **Context-Preserving** | Contracts, OWNERS.md, and docs/ persist knowledge across agent sessions. Agents read artifacts, not each other.     |
| **Human-Friendly**    | The human operator assigns zones, reviews contract changes, and merges.                                              |
| **Model-Agnostic** | The protocol is files in the repo — no external services, no orchestration servers.                                  |

The paradigm lives in **files in the repo**: OWNERS.md for ownership,
CONTRACT.md for interfaces, `scripts/gates/` for local verification, and CI as
the final, non-bypassable gate. Everything else described in older revisions
(auto-merge, dashboards, task queues) is future work — build it when it's
needed, not before.
````
