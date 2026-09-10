# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased] — 2026-09

### Fixed

- Determinism and simulation math corrections across the engine (tick replay, state projection).
- Snapshot validation hardened on ingestion (bounds and sanity checks before state merge).
- Marketplace double-buy wiring: buyer-side replay now resolves listings correctly.
- Airport catalog: replaced 549 bogus "UTC" timezone fallbacks (from OpenFlights `\N`) with
  real IANA zones resolved from coordinates — flight boards no longer drift ±8-14h in
  non-UTC countries (US, AU, CN, RU, hubs IST/DOH, ...). Generator backfills timezones
  the same way on regeneration.
- Aircraft catalog: aligned `fuelBurnKgPerHour` with `fuelBurnKgPerKm × speedKmh` for the
  four regional turboprops (ATR 42-600, ATR 72-600, Dash 8-300, Dash 8-Q400).

### Changed

- CI now runs the full test suite with coverage and thresholds enforced (previously
  coverage was decorative), adds a Pages Functions typecheck gate, and a production
  dependency audit gate (`pnpm audit --prod --audit-level=high`; known to fail until
  the pending dependency updates land).
- `functions/` (Cloudflare Pages) gained a strict tsconfig and root
  `typecheck:functions` script; removed the `VITE_GEMINI_API_KEY` fallback from the
  livery proxy (VITE\_\* variables are inlined into client bundles and must never hold
  server secrets).
- Relay infra: deploy target no longer hardcoded in `deploy.sh` (use `RELAY_HOST` /
  `RELAY_USER`), `strfry.conf` future-event window aligned with the client
  `MAX_FUTURE_SKEW` (300s), nginx gained HTTP-level rate limiting for the relay endpoint.
- Docs truthfulness pass: AGENTS.md corporate-model section split into present vs
  proposed; TIER_PROGRESSION.md regenerated from the real catalog and thresholds;
  snapshot-rollup and tycoon-UI docs merged into SCALABILITY.md / UI_ARCHITECTURE.md;
  contract files re-verified against code; README counts corrected.

### Added

- DoS caps and performance guardrails in ingestion paths.

## [0.1.0] - 2026-02-25

### Added

- Deterministic core engine with fixed-point arithmetic and seeded PRNG.
- Nostr-backed identity and event storage with marketplace integration.
- MapLibre-based globe visualization and virtualized UI lists.
- Fleet management, route scheduling, and operations ledger.
- Initial test suite and CI-ready scripts.
