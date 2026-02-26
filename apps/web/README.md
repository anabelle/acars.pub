# AirTR Web App

React 19 + Vite front-end for AirTR. This app renders the globe, dashboards, and airline management UI. It relies on Nostr (NIP-07) for identity and state persistence.

## Quick Start

From the repo root:

```bash
pnpm install
pnpm dev
```

Then open http://localhost:5173.

## Prerequisites
- Node.js 20+
- pnpm 9+
- NIP-07 browser extension (nos2x, Alby, or Nostr Connect)

## Commands (Repo Root)
- `pnpm dev` — run the web app
- `pnpm lint` — lint all packages
- `pnpm typecheck` — typecheck all packages
- `pnpm test:run` — run all tests once

## Notes
- No environment variables required.
- Nostr relays are configured in `packages/nostr/src/ndk.ts`.
