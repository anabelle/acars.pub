# S57 — New-player UX audit: buy a plane, then the main flows

> **Status:** ☑ ready for review
> **Next step:** —
> **Branch:** `claude/zen-darwin-3op878`
> **PR:** #194
>
> **Track:** UX · **Size:** M (2 steps) · **Depends on:** S56 · **Unblocks:** — · **Asked by the owner (2026-10-10)**
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

The owner tested as a new player and could not buy a plane: the buttons were cut off by their container on both desktop and phone. Fix that, then walk the main flows as a new player on desktop (1440×900) and phone (390×844), looking at real screenshots and clicking through, and fix what gets in the way.

## Why (evidence)

- The dealer's virtual list gave each row a fixed height (430 px on one column). A real catalog photo cannot shrink like the fallback icon, so a card needs 534–663 px and the "Configure & Buy" button fell outside the clipped card. The offline e2e world has no photos, which is why no test saw it.
- The audit script (a Playwright walk through join → home → fleet → dealer → purchase → airport → launch → network → finance, flagging every control clipped by an `overflow: hidden` ancestor) also showed, on phones:
  - the top bar grew to three lines and covered the top of every panel, close button included;
  - panels were see-through, so the airport panel showed under fleet, finance and the briefing;
  - an airport panel stayed open after leaving its URL, stacking two sheets;
  - one route launch raised four toasts that covered the panel header;
  - cramped checklist rows and wrapped route buttons ("Add / aircraft").

## Read first

- `apps/web/src/features/fleet/components/AircraftDealer.tsx`
- `apps/web/src/shared/components/layout/` (`Topbar.tsx`, `PanelLayout.tsx`, `mobileLayout.ts`)
- `apps/web/src/shared/components/feedback/` (`ToastHost.tsx`, `TimelineToastBridge.tsx`)
- `apps/web/src/features/network/components/WorldMap.tsx`

## In scope

- Anything that stops or confuses a new player in: sign-up, home, fleet and dealer, purchase, airport card and route launch, routes, finance, rivals.

## Out of scope

- Redesigning panels or new features.

## Steps (checkpoints)

Each step leaves `pnpm lint && pnpm typecheck && pnpm test` green and is committed + pushed on its own. Tick the box in the same commit.

- [x] **S57.1** Buying a plane works everywhere. Dealer rows are measured instead of fixed; the photo area has a fixed height and can't push the button out; the purchase modal is a real dialog (named, Escape closes it). _Done when:_ e2e on desktop and phone buys a plane with photo-sized images in the cards, and fails on the old layout.
- [x] **S57.2** The main flows, fixed from the audit: phone top bar on one line, opaque phone panels, detail panels follow the URL, no echo toasts, compact phone toast stack, checklist and route rows that fit, launch-button copy. _Done when:_ unit tests + full e2e green, before/after screenshots.

## Acceptance criteria

- [x] A new player can buy a plane on desktop and phone, with real photos.
- [x] On a phone, no panel title or close button sits under the top bar or a toast, and no panel shows through another.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

2026-10-10 · S57.1 · efdd29b · **Buying a plane works everywhere.**

- **Cause:** fixed 430/400 px rows in the dealer's virtual list, with cards that clip. With a real photo (the splash can't shrink) a card needs 534 px (desktop) to 631 px (phone), so the buy button was cut off. The headless world has no photos, so it looked fine in tests.
- **Fix:** rows are measured (`measureElement`) with a 600–640 px estimate; the photo area is `h-40 sm:h-48`, `shrink-0` and clips its image. The purchase modal is `role="dialog"`, named by the aircraft, and Escape closes it. The search icon is centered in its field.
- **Tests:** `fleet-purchase` (desktop) and `mobile-fleet-purchase` add photo-sized images to the cards, check the buy button sits inside its card and nothing overflows, then buy an ATR 42-600 through the dialog. With the old layout put back, both fail.

2026-10-10 · S57.2 · d1eb414 · **The main flows, fixed from the audit.**

- **Phone top bar:** the airline name and cash share one line, so the bar ends above the panels' top edge (`mobileLayout.ts`) instead of covering their title and close button.
- **Phone panels are opaque** (`PanelLayout`, airport and aircraft panels; desktop keeps the glass), so nothing shows through, map buttons included.
- **Detail panels follow the URL:** leaving `/airport/X` or `/aircraft/X` closes that panel. It used to stay open under the next panel, and under the home briefing on phones.
- **Toasts:** a timeline toast for the player's own action (purchase, sale, route or hub change) waits 1.5 s and is dropped if the screen already toasted it; one route launch used to stack four toasts. Phones get a collapsed stack over the top bar instead of an expanded one over the panel header.
- **Fit:** checklist rows wrap their button under the text when narrow; the route list's three buttons sit on one line on phones; the "first landing in ~1.9 h" badge no longer breaks; "Launch route with ATR 72-600" / "with your ATR 42-600 1" (was "with a ATR 42-600 1").
- **Tried and dropped:** hiding the route legend while a detail panel is open made the full-mode perf probe time out; not worth chasing for a cosmetic overlap.
- **Tests:** toast echo (bridge unit test), toaster config, panel backgrounds; full e2e (desktop + phone, 2 workers) green apart from that probe, which passes after the drop. Screenshots: [dealer desktop](../media/s57/dealer-desktop.png), [dealer phone](../media/s57/dealer-phone.png), [fleet phone](../media/s57/fleet-phone.png), [routes phone](../media/s57/routes-phone.png), [home phone](../media/s57/home-phone.png). The audit walk itself: [`ux-audit.spec.ts.txt`](../media/s57/ux-audit.spec.ts.txt) (drop into `apps/web/e2e/` to re-run).
