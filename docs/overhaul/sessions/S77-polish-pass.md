# S77 — Polish pass: play every main flow and fix what is broken or confusing

> **Status:** ◐ in progress
> **Next step:** S77.5 — one key-backup prompt at a time; roadmap copy; short registration; sidebar badges.
> **Branch:** `claude/zen-darwin-3op878`
> **PR:** —
>
> **Track:** Polish · **Size:** M (6 steps) · **Depends on:** S68–S74 merged (#201) · **From:** owner, 2026-10-12: "check and play all main user flows … after so many deep changes it feels a bit sloppy, we should polish it harder before launching public nostr services"

> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

A new player can go from the landing page to a profitable, flying airline without a single confusing screen, and every number they see agrees with the others. No new systems: only fixes to what already ships.

## How it was found

A scripted playtest (desktop 1440 and phone 390) played a new player end to end with the shared relay stub and a fast-forward clock: guest map → join → cockpit → first-hour checklist → opportunities → launch MAD → BCN → delivery → routes, fares, fleet, dealer, plane panel, day plan, finance, rivals, info → 2 h of flying → reload → 8 h away. Screenshots of every step, every console and page error logged. No page errors; the findings are UX.

## Findings

**Broken**

1. Routes → Opportunities: "Open Route ($100,000)" opens a route with **no plane**, while the card promises profit "with an Dash 8-Q400, after lease". The airport card's "Launch route with …" opens, leases and assigns in one go. Two flows for the same intent, and the list's one leaves the player with nothing flying.
2. A confirm dialog survives navigation: on the phone, tapping an opportunity's button and then moving to another page left "Open route? … MAD → LGW" on top of the BCN airport panel. A second confirm also leaked the first one's promise.
3. Buying an aircraft: the order dialog never shows the price, and after "Purchase completed" it stays open on "Purchasing…".
4. The footer said "Airlines 2" after a reload with one player.
5. The cockpit's "Today · Oct 13 · +$984 earned" counted a flight that landed on Oct 12, while the footer's "Today" said $0.

**Confusing**

6. (Owner) A plane on a day plan reads "Unassigned" / "No route assigned"; nothing says whether the day repeats; nothing tells "flies one route back and forth" from "parked".
7. A brand-new airline's top bar shows a red "0%" average load factor before anything has flown.
8. "Suggested fleet: 239 aircraft" on an opportunity: the whole market's need, meaningless to a new player.
9. Two key-backup prompts at once (top banner and corner card) after the first landing.
10. The landing page's roadmap still lists alliances as "planned, not in the game yet".
11. The fleet card shows the internal id ("AC-47DD468E-A80ET-2-0") as the registration.
12. Sidebar count badges sit between two items instead of on their own.

## Steps (checkpoints)

- [x] **S77.1** Plane duty said plainly: "Day plan MAD → BCN → LIS → MAD, every day", "Flies MAD ⇄ BCN back and forth", "Parked at MAD, nothing to fly" in the fleet card, plane panel (info, route tab, day plan section); the day plan says it repeats daily and replaces the single route; "Fly one route instead"; tests.
- [x] **S77.2** Opportunities launch with a plane through the same one-click flow as the airport card (shared hook); drop "suggested fleet"; copy; tests.
- [x] **S77.3** Dialogs and buying: a confirm closes on navigation and never leaks; the aircraft order shows its price and closes when done; tests.
- [x] **S77.4** Numbers that agree: one "today" (UTC day) in cockpit and footer; airlines counted once after reload; "—" load factor before the first landing; tests.
- [ ] **S77.5** Nags and copy: one key-backup prompt at a time; roadmap (alliances shipped); short registration; badges; tests.
- [ ] **S77.6** The playtest as an e2e journey (desktop and phone), before/after screenshots, PR.

## Progress log

2026-10-12 · brief + S77.1 · (this commit) · **Playtest and plane duty.** Findings above from the scripted playtest. `fleet/utils/duty.ts` (`aircraftDuty`: line → route → parked) and `DutySummary`; the fleet card shows it and its route picker names the day plan instead of "Unassigned (Idle)"; the plane panel's route cell and route tab show the day plan's airports and "Repeats every day at these UTC times…"; the day plan section says what the plane does now and that a day plan replaces its single route; "Unassigned" reads "Parked, no route"; the assign button reads "Fly one route instead" on a day-plan plane. en + es. Tests: duty 3, LineSection +2.

2026-10-12 · S77.2 · (this commit) · **Opportunities launch with a plane.** `useConfirmedLaunch` (network/hooks): the one confirm (slot fee, lease deposit, daily lease, delivery time, or the idle plane it reuses) + open, lease, assign + toast, shared by the airport card and the opportunities list. Each opportunity's button now reads "Launch route with ATR 72-600" (disabled when out of range) instead of opening a bare route for $100,000; "with an Dash 8" → "with the Dash 8-Q400, after lease"; the "suggested fleet: 239 aircraft" tile is gone. Tests: opportunities +1 (launch asks once with the full cost; out-of-range disabled); RouteDecisionCard unchanged and green.

2026-10-12 · S77.3 · (this commit) · **Dialogs and buying.** `ConfirmProvider` takes `subscribeNavigation` (main.tsx passes `router.history.subscribe`): any navigation answers a pending confirm "no" and closes it; a newer confirm answers an unanswered one "no" instead of leaking its promise. The aircraft order's footer now says what it costs next to the button ("You pay $21,000,000 now." / "You pay a $2,100,000 deposit now, then $156,000 a month."), red when unaffordable. The "Purchasing…" wait after the timeline toast is the relay publish; the existing echo rule already drops the double toast, so it stays. Tests: useConfirm 3 (new), dealer +2 assertions.

2026-10-12 · S77.4 · (this commit) · **Numbers that agree.** The cockpit story is a rolling 24 hours (by design: a check-in reads "what happened since I last looked"), so its sign now says "Last 24 h · to Oct 13" instead of "Today · Oct 13", which disagreed with the footer's UTC-day "Today". Root cause of "Airlines 2": a world sync that ran before the identity loaded took the player's own snapshot for a rival's and later syncs kept it; `syncWorld` now drops the player's pubkey from `competitors` whenever it knows it (this also kept the player's own offers out of the rival registry). The top bar's load factor reads "—" until the first landing instead of a red 0%. Tests: worldSlice +1, Topbar +1 assertion, TodayStory and e2e headings updated.
