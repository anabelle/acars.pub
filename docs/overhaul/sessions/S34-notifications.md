# S34 — PWA + notifications

> **Status:** ◐ in progress
> **Next step:** S34.2 (S34.3 waits on decision D3)
> **Branch:** `claude/zen-darwin-3op878`
> **PR:** —
>
> **Track:** Loop · **Size:** M (4 steps) · **Depends on:** decision D3 · **Unblocks:** S52 · **Gated by D3**
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

Installable app and a reason to come back: alerts for groundings, tier-ups and rivals on your routes.

## Why (evidence)

- Ledger A17: no manifest, no service worker; design bible §2.2 notification hooks.

## Read first

- `apps/web/vite.config.ts`, `index.html` CSP
- `apps/web/capacitor.config.ts`

## In scope

- Web app manifest, icons, and a service worker (cache shell + static data catalogs)
- Per D3: Nostr DM notifier (recommended first) or a web push pipeline
- Settings UI for notification categories

## Out of scope

- Native push on Android (S52).

## Steps (checkpoints)

Each step leaves `pnpm lint && pnpm typecheck && pnpm test` green and is committed + pushed on its own. Tick the box in the same commit.

- [x] **S34.1** Manifest + icons + installability. _Done when:_ Lighthouse installable.
- [ ] **S34.2** Service worker shell caching + offline banner. _Done when:_ offline reload shows last state.
- [ ] **S34.3** Notification pipeline per D3. _Done when:_ simulated grounding notifies.
- [ ] **S34.4** Notification settings UI (en + es). _Done when:_ screenshots.

## Details & guidance

- Keep the CSP correct for the SW.
- An offline shell shows the last known state with an "offline – changes queued" banner (ties into S22).

## Acceptance criteria

- [ ] Lighthouse PWA installable; notification for a simulated grounding in a test.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

2026-10-06 · S34.1 · (this commit) · **Installable.**

- **Manifest.** New `public/manifest.webmanifest`: name and short name, id/start/scope `/`, standalone, dark theme and background colours, games/simulation categories. Icons: 192 and 512 any-purpose, plus a 512 maskable.
- **Icons.** `scripts/app-icon.html` is the app icon (the favicon's arrow-in-ring glyph, redrawn at 512): a rounded tile, or full-bleed maskable with the glyph inside the 80% safe zone. `scripts/render-app-icons.mjs` renders it with Playwright to `public/icons/` (192, 512, maskable 512, 180 Apple touch icon), like the OG image script.
- **`index.html`.** Links the manifest and Apple touch icon, with the iOS standalone metas. The CSP needs no change: manifest and icons are same-origin.
- **e2e** `pwa.spec.ts`: the manifest's fields; every icon exists, is a PNG and has its declared size; one is maskable. Chrome's own check (`Page.getInstallabilityErrors`, the check behind the install prompt and Lighthouse's installability audit) reports no errors. `in-incognito` is excluded: Playwright's contexts always report it.
- **Note.** D3 (notification architecture) is still open; S34.1–S34.2 don't depend on it, S34.3 does.

## Follow-ups

_None yet._

## Handoff notes

_Filled in when the session completes: what shipped, what didn't, gotchas._
