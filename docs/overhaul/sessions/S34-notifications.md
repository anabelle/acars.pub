# S34 — PWA + notifications

> **Status:** ☑ merged
> **Next step:** — (merged in #181)
> **Branch:** `claude/zen-darwin-3op878`
> **PR:** #181
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
- [x] **S34.2** Service worker shell caching + offline banner. _Done when:_ offline reload shows last state.
- [x] **S34.3** Notification pipeline per D3. _Done when:_ simulated grounding notifies.
- [x] **S34.4** Notification settings UI (en + es). _Done when:_ screenshots.

## Details & guidance

- Keep the CSP correct for the SW.
- An offline shell shows the last known state with an "offline – changes queued" banner (ties into S22).

## Acceptance criteria

- [x] Lighthouse PWA installable (Chrome's installability check, e2e); notification for a simulated grounding in a test (NotificationBridge unit test).

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

2026-10-06 · S34.1 · (this commit) · **Installable.**

- **Manifest.** New `public/manifest.webmanifest`: name and short name, id/start/scope `/`, standalone, dark theme and background colours, games/simulation categories. Icons: 192 and 512 any-purpose, plus a 512 maskable.
- **Icons.** `scripts/app-icon.html` is the app icon (the favicon's arrow-in-ring glyph, redrawn at 512): a rounded tile, or full-bleed maskable with the glyph inside the 80% safe zone. `scripts/render-app-icons.mjs` renders it with Playwright to `public/icons/` (192, 512, maskable 512, 180 Apple touch icon), like the OG image script.
- **`index.html`.** Links the manifest and Apple touch icon, with the iOS standalone metas. The CSP needs no change: manifest and icons are same-origin.
- **e2e** `pwa.spec.ts`: the manifest's fields; every icon exists, is a PNG and has its declared size; one is maskable. Chrome's own check (`Page.getInstallabilityErrors`, the check behind the install prompt and Lighthouse's installability audit) reports no errors. `in-incognito` is excluded: Playwright's contexts always report it.
- **Note.** D3 (notification architecture) is still open; S34.1–S34.2 don't depend on it, S34.3 does.

2026-10-06 · S34.2 · (this commit) · **Offline shell.** New hand-written `public/sw.js` (no new dependency), with these routes:

| Request                                 | Strategy                                                        |
| --------------------------------------- | --------------------------------------------------------------- |
| Page loads                              | Network first; the newest `/` shell is cached and used offline. |
| Hashed `/assets/*`                      | Cache first, capped at 150.                                     |
| Other same-origin static files          | Served from cache, refreshed in the background.                 |
| Non-GET, `/api/*`, relays, cross-origin | Never touched.                                                  |

Precache: `/`, the manifest, the favicon and an icon. Old caches are dropped on activate; it claims clients.

- **Registration.** `registerServiceWorker()`: production builds only, after load. It registers immediately if the page has already loaded; `main.tsx` awaits i18n first, so the load event had usually fired, and a load-only listener never registered (caught by the e2e).
- **Banner.** `OfflineBanner` (`useOnlineStatus` over online/offline events), en/es: "Offline: showing your last saved state. Changes are queued and sync when you're back." The airline state itself comes from the existing local persistence (Dexie + action outbox).
- **Playwright.** It now blocks service workers by default (they would serve requests that specs mock); the PWA specs allow them.
- **e2e** `pwa-offline.spec.ts`: create an airline, wait for the worker to take control, reload, go offline, reload again. The shell boots with the saved airline (name, balance, tier) and the banner; back online, the banner goes. `offline.png` was checked by eye.
- **Tests.** Registration (production after load, already loaded, failure logged, dev or unsupported), banner (offline → online).

2026-10-06 · S34.3 · (this commit) · **Notifications (D3 decided by the owner: local first, Nostr DM bot later).**

- **Rules.** `features/notifications/notificationRules.ts`:
  - Four categories: grounding (the engine's daily `evt-grounded-*` safety alert, not routine checks), tier-up, rivals (new `competitor_route` plus `competitor_hub`) and finance (warning, bankruptcy).
  - `planNotification` gives a tag per aircraft / route / category, so a notification refreshes instead of stacking, and drops the `[SAFETY ALERT]` log prefix.
  - Settings: master switch off by default, every category on, persisted in localStorage with validation; `notificationSettings.ts` is an external store hook for S34.4.
- **Bridge.** `NotificationBridge` (mounted in `main.tsx`) raises a system notification for new events only while the app is out of view (in view, the toasts already show them) and only with permission granted. It shows through the service-worker registration when there is one (required on Android), else with `new Notification`. At most 3 per batch. Catch-ups after an absence are skipped (the away report covers them).
- **Service worker.** `sw.js` focuses an open window on a notification tap, or opens `/`.
- **New event.** `competitor_route` (core type, reducer whitelist, toast title en/es). World sync calls the pure `rivalRoutesNewOnYourPairs` (either direction, active routes only, silent on a rival's first sync) next to the competitor-hub alert.
- **Refactor.** The toasts, map landing labels and notifications now share `subscribeToNewTimelineEvents` (live events, catch-ups skipped) instead of three copies.
- **Tests.** Categories, plans, settings storage and store, notifier (permission, visibility, service worker vs direct). A simulated grounding notifies when hidden and stays quiet in view, without permission, when off or during a catch-up. The rival-route detector has its own tests.

2026-10-06 · S34.4 · (this commit) · **Settings card.** `NotificationSettingsCard` ("Alerts on this device") sits at the end of your cockpit (not when viewing a rival).

- **Turn on.** Asks the browser's permission and enables alerts only if granted.
- **When on.** Four category checkboxes with descriptions, plus Turn off.
- **Other states.** Explains blocked and unsupported notifications.
- **Permission.** `permission.ts` wraps the Notification permission (injectable for tests).
- **i18n.** en and es (`notifications.settings.*`).
- **e2e** `notification-settings.spec.ts`: with notifications permission granted, turn on, uncheck Rivals; the choice is saved. Switch to Spanish and reload: the card is translated and the choice persisted. Screenshots `notifications-off-en`, `notifications-on-en` and `notifications-on-es` were checked by eye.
- **Tests.** The card (grant, refuse, already granted, blocked, unsupported, categories, off) and the permission wrapper.

2026-10-06 · S34.4 fix · (this commit) · **CI e2e.** CI's Playwright headless shell has no usable Notification permission, so the card showed its unsupported or blocked state and the spec never found "Turn on alerts". Reproduced locally with the headless shell. The spec now installs a stand-in Notification API (permission persisted across the reload), because it tests the app's settings flow, not the browser. The real permission wrapper is unit-tested. The spec passes in both the headless shell and full Chromium.

## Follow-ups

- **Nostr DM bot (D3, part 2).** A scheduled Worker with a bot key that reads opted-in players' checkpoints and DMs groundings, tier-ups and rival moves, so alerts arrive while ACARS is closed. It needs a bot secret in Pages env, a cron trigger and an opt-in event.
- **Offline action queue UI.** The banner says changes are queued (they are: the action outbox). A count of pending actions would make it concrete.
- **Service-worker updates.** The shell cache refreshes on each online load; a "new version, reload" prompt could follow if deploys get frequent.

## Handoff notes

- **Shipped.**
  - The installable PWA (manifest, icons, Chrome installability e2e).
  - An offline shell (hand-written service worker; the offline reload shows the last saved airline, with a banner).
  - Local system notifications (D3: local first) for groundings, tier-ups, rivals (new `competitor_route` event) and finance, shown while the app is out of view.
  - A per-device settings card (en/es).
- **Not done.** The Nostr DM bot for alerts while closed (follow-up per D3). Native push is S52.
- **Gotchas.**
  - `main.tsx` awaits i18n, so `load` has usually fired before the service worker registers: register immediately when the document is already complete.
  - Playwright blocks service workers by default now (they'd serve requests specs mock); only the PWA specs allow them.
  - Chrome reports `in-incognito` installability in Playwright contexts; ignore just that.
  - Cloudflare Pages redirects `/index.html`, so the shell is cached as `/`.
