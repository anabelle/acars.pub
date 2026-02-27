# Contributing to ACARS

Thanks for your interest in contributing. ACARS is a deterministic, client-side simulation built on Nostr. Please read the constraints and follow the workflows below.

## Ground Rules
- No central database. State is derived from Nostr events.
- Real-time sync only (1:1 with UTC).
- O(1) math over O(N^2) loops.
- Fixed-point arithmetic only for money (`@acars/core/src/fixed-point.ts`).
- All large lists must be virtualized.

See `AGENTS.md` and `docs/AGENT_DEVELOPMENT_PARADIGM.md` for the full engineering rules.

## Getting Started
1. Fork the repo and clone your fork.
2. Install dependencies: `pnpm install`
3. Start dev server: `pnpm dev`

## Development Workflow
- Create a branch from `main`.
- Use conventional commits (e.g., `feat: add route profitability view`).
- Keep changes scoped to a single feature or fix.
- Run checks before pushing:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test:run`

## Project Structure
- `packages/core`: deterministic math engine (no runtime deps)
- `packages/data`: static catalogs (airports, aircraft, hubs)
- `packages/nostr`: NDK integration and event schema
- `packages/store`: Zustand store and flight engine
- `packages/map`: MapLibre globe and visualization
- `apps/web`: UI layer

## Reporting Issues
Use GitHub Issues for bugs and feature requests. Provide reproduction steps, expected behavior, and relevant logs/screenshots.

## Security
For security issues, follow `SECURITY.md`.
