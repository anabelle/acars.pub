# ACARS Blueprint v2 — the game we are building next

> Consolidated from the owner's planning session of 2026-10-10 (after S57). This is the north
> star for the next wave of overhaul sessions. Status and decisions live in
> [`STATUS.md`](STATUS.md); each session gets a brief in [`sessions/`](sessions/) when it
> starts.
>
> Mockups (private canvas, owner's account): https://claude.ai/artifact/E1Bdn2wDABhPRFpmGSgGC1.
> Rows v1–v3 are explorations; **v4–v6 are the direction**, and v6 shows the new art direction.

## 1. North star

**Your airline, painted and flying the real world, in real time.**

Flightradar24's truth, an airline CEO's instruments, a collector's love for every plane, and
passengers you can actually see. Played a few minutes at a time, shared on Nostr.

## 2. What the session found (why change)

| Finding                         | Evidence                                                                                                                                                                                                                    |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Planes sit idle most of the day | Routes open at 7 round trips/week and frequency never rises when a plane is added, so each extra plane flies _less_ (`cycle.ts` `scheduledRoundTripTicks`). An ATR on MAD–BCN flies ~3 h a day; real short-haul does 10–13. |
| The art is hidden               | Every plane has an AI-painted livery (56 on the public relays, e.g. Pixel Airlines), but the UI shows grey icons and text.                                                                                                  |
| Passengers are a number         | Leg results already carry passengers per class, load factor and **spilled passengers**, but nothing shows them.                                                                                                             |
| Decisions are blind             | A frequency, fare or plane choice pays off hours later with no forecast and no comparison.                                                                                                                                  |
| The look is generic             | Dark glass panels, neon cyan/emerald, glows: the "LLM dashboard" look. It hides the liveries instead of framing them.                                                                                                       |

## 3. Pillars

1. **Pride** — liveries are every plane's face; planes are collected, named and remembered.
2. **Real** — UTC 1:1 on real geography; real airline instruments, ACARS messages and real weather.
3. **Decisions** — few, meaningful, with a visible forecast: schedule, frequency, fares, buffers, rivals.
4. **People** — passengers are visible (aboard, turned away, booking); rivals are real players.
5. **Social** — every proud moment is a Nostr-native post, badge or zap; the world is open to build on.

## 4. Structure

**One live world, three things to open.** The map is always there; only three things open over it.

| Open             | Shows                                                                                                                            |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **A plane**      | Livery hero image, flight (UTC times, progress, ETA), who's aboard, leg money, its line of flying, last ACARS messages, logbook. |
| **An airport**   | Departure board with your and rivals' flights in brand colours, bookings, people turned away, weather (METAR), hub banks.        |
| **Your airline** | Hangar (collection), lines of flying, money and instruments, league, poster.                                                     |

Everything else (finance, fleet manager, routes) lives inside those. Phone: the same three as
bottom sheets, plus a **Today** tab (the check-in story).

## 5. Loops

| Loop     | What happens                                                                          |
| -------- | ------------------------------------------------------------------------------------- |
| Minutes  | A landing, an ACARS ping, a hold over a stormy airport, a flight filling up.          |
| Check-in | The story: what you earned, your top plane, three things that need you, one tap each. |
| Day      | Shape lines of flying; buffers against weather; hub banks.                            |
| Week     | League, deliveries (water salute), milestones, rival moves, the Aviation Ledger.      |
| Season   | Festivals and world events, hurricane/strike seasons, new tiers and aircraft types.   |

## 6. Systems

Legend: **now** = no economy change, can start; **D#** = needs that owner decision; **later** = polish.

### Pride

- **Livery-first UI** (now): livery image as hero of the plane panel, thumbnails in lists, map icons in airline colours, rivals' art on tap.
- **Hangar as a collection** (now): big livery cards with 7-day profit, flying hours, condition, status; "top earner" and "idle" states with one-tap fixes.
- **Delivery day** (now): every new plane gets a ceremony — the water salute, the reveal of its painting, naming it, its first flight already selling. The first plane of a new type gets a bigger one.
- **Logbook** (now): per plane — hours, landings, passengers, distance ("48 times round the Earth"), money earned, on-time, milestones, airport "passport" stamps, a passenger quote.
- **Spotter's book** (now): every catalog type, owned / next / locked, completion count.

### Real

- **Flight panel à la Flightradar24** (now): UTC times, delay vs schedule, progress, altitude/speed/heading.
- **ACARS feed** (now): OUT/OFF/ON/IN and position messages generated from the engine's own events, as the airline's event log.
- **Instruments** (now): utilization (h/day), load factor, unit margin (revenue minus cost per seat-km), on-time, cash runway — each with a target band, trend and a one-tap fix.
- **Real weather oracle** (D11): METAR and TAF from NOAA (public domain), published as signed Nostr events by a known ACARS weather key — one addressable bundle per region per hour (~40 KB for 500 airports). Effects apply after a fixed lag (a 14:00Z report affects flights from 14:20Z); a missing bundle means neutral weather. Each report reduces to a few factors (flight category, gusts/crosswind, TS/FG/SN) that set airport capacity per hour; delays, holds and diversions follow deterministically (seeded by flight id). Weather in the log makes replays exact. Later: 2-of-3 oracles.
- **ATC layer** (D11): flow-control slots (CTOT) when an hour is over capacity, holding stacks, diversions, strikes as world events — each with a decision (hold, divert, swap a plane).

### Decisions

- **Utilization fix** (now): sensible starting frequency, frequency rises with assigned planes, idle-time warnings.
- **What-if curves** (now): profit/day against frequency and fare, with the sweet spot, physical maximum and rival share, from the existing O(1) projection.
- **Lines of flying** (D9): a plane flies a daily line of several routes instead of one route. 24-hour board per plane; drag legs into gaps; auto-fill for casual players. Turnaround **buffers** against **knock-on delays** (on-time = within 15 min).
- **Hub banks** (D10): arrivals and departures in waves create connecting passengers (computed per bank, O(1)).
- **Published timetables** (D12): schedule and fare changes take effect the next day. Removes the "online at 3 a.m. wins" edge, gives rivals time to answer, and is how real airlines work.
- **Fares while filling** (D13): flights fill over the hours before departure (booking curve); raising the last bucket is a real revenue-management decision. v1 can be visual only.

### People

- **Passengers visible** (now): cabin strip by class on each flight, "turned away" counts at airports (spill), landing receipts, booking bars on departure boards. Dots and crowds are drawn from aggregates — never simulated people.
- **Passenger groups** (D14): business / leisure / visiting family with different sensitivities (frequency, price, season, events).
- **Voices** (now, rare): short quotes generated deterministically from a flight's own numbers.

### Social (Nostr-native)

- **Delivery posts** (D18): opt-in picture notes (NIP-68) of the livery reveal to public relays — visible in image-first clients, zappable.
- **Badges** (D18): NIP-58 badges for milestones ("First water salute", "A380 owner", "Survived hurricane season"), shown on profiles everywhere.
- **Livery zaps**: tip the art; zaps from distinct accounts, weighted by web of trust, nudge brand slightly (real money resists fake accounts).
- **Friends league**: rank the airlines of the people you follow.
- **Rivalry notes** (D18, opt-in, rate-limited): "Jazzmin enters Panama City".
- **The Aviation Ledger**: a weekly long-form article (NIP-23) generated from the log.
- **Alliances and codeshares** (D16): partners feed each other's hub banks; NIP-29 groups host them. Cooperation pays in a repeated game.
- **Open ecosystem**: spotter apps, analytics, oracles and alternative clients can all read the public log. Livery generation can be paid in sats via NIP-90.
- **Guardrail**: game state stays on the dedicated relay; only opt-in social moments go to public relays.

### Fair play

- **Ranked entry** (D15): proof-of-work or a small Lightning stake to create a ranked airline (stops throwaway fare-dumping airlines).
- **Anti-dumping**: fares below cost win no extra demand; bankruptcy stops a dumper.
- **Seasons and tiers**: leagues per tier; per-plane metrics (unit margin, on-time) beside totals; non-competitive progress through logbook and spotter's book.
- **Frequency-war stabilizers**: costs that rise with frequency, scarce hub slots, capped demand; the what-if curve teaches the equilibrium.

### Wonder (later)

- 3D follow camera (MapLibre pitch + terrain, one model for the selected plane), hub apron with your parked planes, night globe with city lights, sound.

## 7. Game theory (summary)

| Dynamic                               | Risk                              | Answer                                                          |
| ------------------------------------- | --------------------------------- | --------------------------------------------------------------- |
| Frequency competition (S-curve share) | Prisoner's dilemma, over-capacity | Convex costs, slot scarcity, demand cap, what-if curve          |
| Fare competition                      | Race to cost                      | Brand/on-time differentiation, elasticity floor, next-day fares |
| Perfect information (public log)      | Copycats, sniping                 | Accept; next-day timetables; commit-reveal for sealed slot bids |
| Real time across time zones           | Night owls win                    | Published timetables, auto-fill, buffers                        |
| Free keys                             | Sybil dumping                     | Ranked entry cost, anti-dumping, bankruptcy                     |
| Early movers                          | Locked leaderboard                | Seasons, tier leagues, per-plane metrics                        |
| Zero-sum                              | Lonely                            | Alliances, codeshares, hub banks                                |

## 8. Art direction: "Chart & Ink"

The old look (dark glass, neon cyan/emerald, glows, blur, gradients) goes. The new look borrows from
real aviation print: aeronautical charts, airline timetables, boarding passes, airport signage and
mid-century airline posters. The UI is quiet paper and ink so **each airline's livery colours are the
only loud colour on screen**.

**Principles**

1. Paper and ink, not glass and glow: flat surfaces, hairline rules, no blur, no glows, no gradients.
2. Brand colour belongs to airlines: chrome is neutral; routes, planes and accents use the airline's livery colours.
3. Colour means something: amber = needs attention, red = trouble, green = good. Nothing else is coloured.
4. Real photography-like art is the hero: livery images are framed like prints, with generous margins.
5. Charts, not dashboards: airports drawn like chart symbols, routes as fine ink lines, numbers set like a timetable.
6. Day and night follow the sun: a light chart by day and an ink-blue night chart, switched by the player's local daylight (or a setting).

**Tokens (v1)**

| Token               | Day       | Night     |
| ------------------- | --------- | --------- |
| `paper` (ground)    | `#F3EFE6` | `#141A22` |
| `paper-2` (raised)  | `#FBF9F4` | `#1C232D` |
| `ink` (text)        | `#1C2530` | `#ECE6D9` |
| `ink-2` (secondary) | `#5A6472` | `#A7ADB5` |
| `rule` (hairlines)  | `#D9D2C3` | `#2C3542` |
| `water`             | `#DDE6EB` | `#16202A` |
| `land`              | `#F3EFE6` | `#1F2732` |
| `coast`             | `#9EB0BD` | `#3A4A5A` |
| `attention`         | `#B86A12` | `#E0A050` |
| `trouble`           | `#B23A2E` | `#E27A6E` |
| `good`              | `#2E7A55` | `#7CC49B` |

Airline colours (`livery.primary/secondary`) are used as-is for that airline's planes, routes and highlights.

**Type**: display **Instrument Serif** (poster headlines, plane names); text **Public Sans** (signage-like
legibility); numbers and codes **IBM Plex Mono** (timetable figures, IATA codes, UTC).

**Components**: departure-board rows (mono, ruled), chart-symbol airports (circle with tick marks; hubs
double ring), boarding-pass cards for flights, print-framed livery cards, gauge = thin arc on paper with
a target band, buttons as solid ink or outlined, 44 px targets.

**Motion**: slow and physical — planes glide, flights fill, the water salute arcs. No pulsing glows.

## 9. Architecture rules (unchanged, restated)

- Deterministic and O(1): visuals of passengers, crowds and voices come from aggregate numbers.
- Everything that affects state is a signed Nostr event (including weather), so replays are exact.
- Virtualize lists; 3D only for what is selected; respect low-power mode (S54 budgets).
- Fixed-point money everywhere.

## 10. Roadmap

Session numbers are reserved; each gets a brief when it starts.

**Wave A — no economy change (can start now)**

| Session | Scope                                                                                     | Needs |
| ------- | ----------------------------------------------------------------------------------------- | ----- |
| S58     | Utilization fix: starting frequency, frequency scales with assigned planes, idle warnings | —     |
| S59     | Art direction foundation: tokens, fonts, day/night themes, retire neon/glass              | D17   |
| S60     | Livery-first plane panel (Flightradar24 layout) and hangar collection                     | S59   |
| S61     | Delivery day (water salute, naming), logbook, spotter's book                              | S60   |
| S62     | Instruments and the check-in story (Today tab)                                            | S59   |
| S63     | Passengers visible: cabin strip, turned away, receipts, booking bars                      | S60   |
| S64     | What-if curves for frequency and fares                                                    | S58   |
| S65     | ACARS feed from engine events                                                             | S60   |

**Wave B — economy and social decisions**

| Session | Scope                                                                 | Needs    |
| ------- | --------------------------------------------------------------------- | -------- |
| S66     | Lines of flying, buffers, knock-on delays                             | D9       |
| S67     | Hub banks and connecting passengers                                   | D10, S66 |
| S68     | Weather oracle (METAR/TAF on Nostr) and ATC layer                     | D11      |
| S69     | Published timetables (next-day changes)                               | D12      |
| S70     | Booking curve and fares while filling                                 | D13      |
| S71     | Passenger groups and voices                                           | D14      |
| S72     | Ranked entry, anti-dumping, seasons                                   | D15      |
| S73     | Alliances and codeshares                                              | D16, S67 |
| S74     | Social: delivery posts, badges, rivalry notes, friends league, Ledger | D18      |

**Wave C — wonder**: S75 3D follow camera and apron; S76 night globe and sound.

## 11. Decisions for the owner

| ID  | Decision                                                                    | Recommendation                                    |
| --- | --------------------------------------------------------------------------- | ------------------------------------------------- |
| D9  | Lines of flying replace one-route-per-plane                                 | Yes — the core puzzle and the fix for idle planes |
| D10 | Hub banks and connecting passengers                                         | Yes, after D9                                     |
| D11 | Real weather oracle (who runs it; single key first)                         | Yes, one ACARS key first, 2-of-3 later            |
| D12 | Published timetables (changes take effect next day)                         | Yes — fair across time zones                      |
| D13 | Fares while filling affect revenue                                          | Visual first, decide after S63                    |
| D14 | Passenger groups in the demand model                                        | Yes, light: three groups                          |
| D15 | Ranked entry cost (proof-of-work or sats)                                   | PoW first, sats for prize leagues                 |
| D16 | Alliances and codeshares                                                    | Later, after D10                                  |
| D17 | Art direction "Chart & Ink"                                                 | Yes                                               |
| D18 | Opt-in social posts to public relays (picture notes, badges, rivalry notes) | Yes, opt-in, rate-limited                         |
