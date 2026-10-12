# S68 — Weather oracle (METAR on Nostr)

> **Status:** ◐ in progress
> **Next step:** S68.4 — e2e with a signed bundle from a fake relay; screenshots; PR
> **Branch:** `claude/zen-darwin-3op878`
> **PR:** — (next)
>
> **Track:** Real · **Size:** M (4 steps) · **Depends on:** D11 ✅ (2026-10-12), S66 · **From:** [`../BLUEPRINT.md`](../BLUEPRINT.md) §6 Real

> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

Real weather slows real airports: a thunderstorm at Dallas, fog at San Francisco or snow at Boston delays departures there, on every client the same way, and the player sees why.

## Design

- **Source:** METAR from NOAA (aviationweather.gov, public domain), fetched hourly by a publisher script the owner runs with the world's weather key (D11: one key first, 2-of-3 later).
- **Bundle:** one addressable Nostr event per UTC hour (kind 30078, `d = airtr:world:<world>:weather:<YYYYMMDDHH>`), content `{ issued, airports: { MAD: [category, gustKt, flags] } }` — a few bytes per airport. Clients accept bundles only from the configured weather pubkey; a missing bundle means calm.
- **Effects:** a report issued at HH:00 applies to departures from HH:20 (fixed lag). Each departure on a line of flying (S66) gets an extra, deterministic delay at its origin: marginal 0–10 min, IFR 10–30, low IFR 30–90, thunderstorms +30–75, snow +20–50, gusts over 35 kt +10–20; buffers absorb it, the rest knocks on (never past the day). Shuttle cycles are unchanged for now.
- **Bounded:** one bundle per hour, a lookup per departure; nothing per passenger.

## Steps (checkpoints)

- [x] **S68.1** Core: `parseMetar` (category from ceiling/visibility in SM or metres, gusts in KT/MPS, TS/FG/SN, remarks ignored), compact encode/decode, `weatherDelayTicks`, `describeWeather`, `WEATHER_LAG_TICKS`.
- [x] **S68.2** Nostr: bundle builder/parser (strict), publish, subscribe (weather pubkey only); `scripts/weather-publish.ts` (fetch METARs, reduce, sign, publish) with docs for the owner.
- [x] **S68.3** Engine: lines take a weather lookup (origin, departure) → extra delay; store keeps recent bundles; delays show in on-time and ACARS ("WX IFR · TS").
- [ ] **S68.4** UI: weather at the airport panel and boards; e2e with a stubbed bundle; screenshots; PR.

## Progress log

2026-10-12 · brief · (this commit) · Written after the owner's D11 "yes, one key first" and a read of how the nostr package publishes and loads addressable events (catalog images).

2026-10-12 · S68.1 · (this commit) · **Weather, in core.** `weather.ts`: `parseMetar`, `encodeWeather`/`decodeWeather` (strict), `weatherDelayTicks` (seeded by flight), `describeWeather`, `WEATHER_LAG_TICKS`. Tests: clear days, categories (SM, fractions, metres, VV), fog, snow, gusts (KT, MPS), thunderstorms, remarks ignored, garbage → calm; round-trip; delays by severity and deterministic. Core coverage holds (100 % functions).

2026-10-12 · S68.2 · (this commit) · **Bundles on Nostr, and the oracle.**

- `weatherBundle.ts` (nostr, pure): hour keys, d-tag `airtr:world:v6-beta:weather:YYYYMMDDHH`, `buildWeatherEvent` (sorted, compact), `parseWeatherEvent` (strict: weather key only, kind, d-tag = issued hour, ≤128 KB, ≤6,000 airports, 3-letter codes, valid factors). `weather.ts`: `loadWeatherBundles(pubkey, now, hours)` keeps the newest valid bundle per hour.
- **Oracle**: `pnpm weather:publish` (`packages/nostr/scripts/weather-publish.ts`): the 500 biggest airports (one per city), METARs from aviationweather.gov in chunks of 100, `parseMetar`, sign with `WEATHER_NSEC` (nostr-tools; the key never leaves the process), self-check with the client's parser, publish to 4 relays. `--dry-run` works without a key: live run here read 34/40 airports into a 532-byte bundle (Heathrow MVFR at OVC011, Singapore/Delhi IFR in haze — correct by the category rules).
- Tests: hours, round-trip, every rejection; loader with a mocked relay (other authors ignored, newest per hour). Nostr 136/136, coverage 87.9 %.
- **Owner setup** (when ready): generate a key (`nak key generate` or any Nostr client), run `WEATHER_NSEC=nsec1… pnpm weather:publish` hourly (cron `2 * * * *`), and set `VITE_WEATHER_PUBKEY` to its hex pubkey in the web build. Until then the game is calm everywhere.

2026-10-12 · S68.3 · (this commit) · **Weather flies.**

- Core: every line function takes an optional `WeatherLookup`; a leg's departure adds its origin's weather delay (report of the hour 20 min before departure), seeded by plane/day/leg; `LineFlight.weatherTicks`; the no-spill cap and the O(legs) counts still hold (tests with a storm).
- Store: `useWeatherStore` (hour → airport → factors, two days kept), `weatherAt`, `tickHourKey`; the live engine and catch-up pass it to line planes; landing details `weatherDelayTicks`.
- Web: `WeatherBridge` (root) loads the last 3 hours of bundles every 10 min when a weather key is set (`VITE_WEATHER_PUBKEY`, or `localStorage.acars_weather_pubkey` for testing); `AirportWeather` in the airport panel ("IFR · TS · G38", what it does to departures; silent without a report); ACARS OUT ends in "WX" when weather caused part of the delay.
- Tests: core (storm delays, no spill, counts), store (hour keys, retention, engine records weather delays only from the stormy origin), web (key, bridge, card, ACARS). Web suites 674/674, store 298/298.
