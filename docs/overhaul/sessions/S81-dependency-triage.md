# S81 — Dependency triage: production updates, Dependabot by risk

> **Status:** ◑ in review
> **Next step:** — (merge; Dependabot then closes #192 on its own)
> **Branch:** `claude/zen-darwin-3op878`
> **PR:** (opening)
>
> **Track:** Maintenance · **Size:** S (1 step) · **From:** owner, 2026-10-14: "can you audit and triage open prs" … "all 3"

## Triage (2026-10-14)

- #192 (Dependabot, 11 production updates): CI red on one thing, lucide-react 1.x dropped brand icons (`Github` on the About page). Redone here, on today's main.
- #197 (Dependabot, 28 dev updates): bundles TypeScript 7, Tailwind 4, Vite 8, Vitest 5, ESLint 10, jsdom 30, commitlint 21 and lint-staged 17 with the routine patches; red on TypeScript 7 (Node types no longer implicit). Closed: each migration deserves its own session.
- #118 (Copilot, push notifications, March): 4.6 k lines, conflicts with main, a second service worker and manifest next to S34's, and a D1 database for registrations (Rule 1). Closed: server push, if wanted, gets designed fresh on top of S34.

## Changes

- Production updates from #192: maplibre-gl 6.14, Capacitor 8.5.3, Radix slot 1.4, TanStack query/router/virtual, i18next 26, react-i18next 17, lucide-react 1.53, tailwind-merge 3.7. i18next 26 removes options we don't use (`initImmediate`, `interpolation.format`, `simplifyPluralSuffix`); react-i18next 17 only changes auto-keyed `<Trans>`, which we don't use.
- About page: an inline GitHub mark replaces lucide's removed `Github` icon.
- `public/maplibre/` worker copies recopied from maplibre-gl 6.14. Found by the e2e: with a 6.9 worker and a 6.14 main thread every tile failed with "can't deserialize unregistered class StructArrayLayout2i4ub8". New `maplibreWorkerCopy.test.ts` fails whenever the copies drift from the installed version.
- `package.json` lint-staged: the formatter skips `public/maplibre/` (and now matches `airports.ts` by absolute path too).
- `.github/dependabot.yml`: minor and patch updates stay grouped (dev, prod); each major comes as its own PR.

## Progress log

- 2026-10-14 · S81.1 · updates + icon + worker recopy + guard test + Dependabot groups. Typecheck, lint (0 errors), 1,869 unit tests, build, and e2e on desktop and mobile (map, first hour, aircraft icons, night globe, ACARS, fleet purchase, layout, meta) pass.
- 2026-10-14 · S81.2 · the pre-commit formatter had rewritten the vendored worker (and the 6.9 copy before it); `lint-staged` now skips `public/maplibre/`, the 6.14 worker ships byte for byte (`maplibre-gl-shared.mjs` is empty upstream in 6.14). Map e2e re-run on the exact file: pass.
