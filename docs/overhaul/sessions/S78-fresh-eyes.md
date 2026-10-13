# S78 — Fresh eyes: one clear screen at a time

> **Status:** ◐ in progress
> **Next step:** S78.5 — Info opens on "How to play" in six steps.
> **Branch:** `claude/zen-darwin-3op878`
> **PR:** —
>
> **Track:** Polish · **Size:** M (7 steps) · **Depends on:** S77 merged (#202) · **From:** owner, 2026-10-13: "still strange things and confusing feel, give it another pass with fresh eyes, be not afraid of changes to improve ux"

> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

S77 fixed what was broken. This pass fixes the hierarchy: every screen says one thing first, uses the name the menu uses, and hides what a player doesn't need yet. Structural changes are allowed; no new systems.

## Findings (replayed playtest on main after #202, desktop 1440 and phone 390)

1. **The cockpit is a wall.** Eleven sections: story, four instruments, ACARS, first-hour checklist, daily goals, world events, three status cards, "what to fix first", four action links, network, activity. A new player's one job (the checklist) is below four empty gauges reading "—" and an empty message log. The status cards repeat the top bar; the action links repeat the sidebar; "All good" is filler.
2. **Three bars of chrome before content.** Top bar (name, account key, relays, cash, brand, tier with two micro-bars, load factor), a context bar repeating each panel's title in other words, then the panel header. The ticker below has ten items, some ambiguous ("Planes 3" is the world's, not yours).
3. **One place, three names.** Sidebar "Routes" opens "Network", "Rivals" opens "Leaderboard", "Fleet" opens "Fleet Manager", "Finance" opens "Finance Overview", "Info" opens "About"; the cockpit's title is a "Share my network" button.
4. **Info has no how-to-play**, only Nostr background.
5. **Fleet opens on an advanced setting** (auto-maintenance threshold) above the planes.
6. **Opportunity cards lead with jargon** (total market, addressable, destination capacity, slot-controlled, an unlabeled class-mix bar, cost split) before the three things that decide: where, how long, how much a day.

## Steps (checkpoints)

- [x] **S78.1** Cockpit: titled "Cockpit"; the first-hour checklist first; instruments and ACARS only once something has flown; the player's own status cards gone (except the offline card); "what to fix first" only when something needs the player, without links that repeat the sidebar; tests.
- [x] **S78.2** One name per place: panel titles are the menu's names; the context bar shows only when viewing a rival; tests.
- [x] **S78.3** Top bar diet: cash, load factor and next tier in words; brand and relays move out; ticker groups the world's counts; tests.
- [x] **S78.4** Fleet: planes first; auto-maintenance is one line that opens its settings; tests.
- [ ] **S78.5** Info opens on "How to play" in six steps; tests.
- [ ] **S78.6** Opportunity cards: where, flight time, profit a day and rivals first; the market numbers behind "Details"; tests.
- [ ] **S78.7** e2e (desktop and phone), before/after screenshots, PR.

## Progress log

2026-10-13 · brief + S78.1 · (this commit) · **The cockpit says one thing first.** For the player's own airline: an h1 "Cockpit" with the share button beside the close button; the first-hour checklist on top (it hides itself when done); the Last-24-h story; "What to fix first" only when an insight is not "all good" or an action is not a plain link (tune routes / finances / rivals links dropped: the sidebar has them); instruments and the ACARS log only after the first landing; daily goals and world events; status cards only for a rival's cockpit, plus the connection card when offline. A rival's cockpit is unchanged. Tests: cockpit +1, relay-card tests updated.

2026-10-13 · S78.2 · (this commit) · **One name per place.** Panel titles are the menu's names in both languages: Routes (was Network), Fleet (Fleet Manager), Rivals (Leaderboard), Finance (Finance Overview), Info (About). The context bar under the top bar no longer shows on the player's own airline in normal play (each panel header already says where they are); it still speaks for a rival's airline, a guest or a bankrupt airline. Tests: WorkspaceContextBar 3 (new); about and route-manager titles updated.

2026-10-13 · S78.3 · (this commit) · **Top bar diet.** Three readouts instead of six: Cash, Next tier and Seats filled (was Corporate balance, Brand, Tier with two micro-bars, Avg load factor, "9 relays online"). The tier says, in words, what still stands in the way — "2 more routes", then "$2.9M more revenue", then "Ready to move up" — with the full requirement in the tooltip. Brand lives in Finance. The relay count only shows when relays are down (the ticker's LIVE dot covers the normal state; the live region stays for screen readers). Ticker: "World 1 airline · 3 planes · 2 routes" as one item, so world counts never pass for the player's own; "Status: Normal operations" only appears during a catch-up. en + es. Tests: Topbar, Ticker updated.

2026-10-13 · S78.4 · (this commit) · **Planes first.** Fleet-wide auto-maintenance is one line above the planes: "Auto-maintenance [Off]" (or "[On] services at 40%") and a Settings toggle; the explanation, threshold and hub-only options open from Settings. The switch stays one tap away. en + es. Tests: maintenance policy updated (options hidden until Settings).
