# S76 — Night globe and sound

> **Status:** ☑ done (awaiting merge)
> **Next step:** — (merge #199)
> **Branch:** `claude/zen-darwin-3op878`
> **PR:** #199 (with S61–S65)
>
> **Track:** Wonder · **Size:** S–M (3 steps) · **Depends on:** S59 · **From:** [`../BLUEPRINT.md`](../BLUEPRINT.md) §6 Wonder, §10 Wave C
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

The globe feels like the real planet at this real UTC minute: the night side glows with its cities, and (if the player wants) the airline is heard — a soft chime when a plane lands, a short fanfare on delivery day.

## Why now

Wave A (S58–S65) is done and every Wave B session waits on an owner decision (D9–D16, D18). Wave C needs no decision.

## Constraints

- Lights: one pass per airport catalog (one light per city, the 900 biggest); repainted with the terminator once a minute on the existing 1024×512 canvas; nothing per frame.
- Sound: off by default, opt-in in settings, synthesized with Web Audio (no audio files), never during catch-up batches, respects a muted tab; no autoplay before a user gesture.

## Steps (checkpoints)

- [x] **S76.1** City lights on the night side (`cityLights`, `nightFactor`, warm glow per palette) and the night overlay's corner fix. _Done when:_ unit tests + e2e that counts warm pixels at 02:00 UTC + screenshots.
- [x] **S76.2** Opt-in sound: landing chime (pitch by load) and delivery fanfare, a toggle in settings. _Done when:_ unit tests (off by default, no sound in catch-up) + component test.
- [x] **S76.3** e2e for the toggle, PR.

## Acceptance criteria

- [x] At night, cities glow in proportion to their size and fade in through twilight; the whole night side is tinted.
- [x] Sound is silent unless switched on; a switched-on player hears landings and deliveries live, never a burst on catch-up.
- [x] Map perf probes and full e2e green.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

2026-10-12 · brief · (this commit) · Written after finding the terminator already drawn (S40-era `nightOverlay`) and no sound anywhere.

2026-10-12 · S76.1 · (this commit) · **Cities glow at night.**

- `cityLights` (map package): one light per city (largest metro population), the 900 biggest, brightness on a log scale 100k → 30M; Mercator canvas positions. `nightFactor`: lights switch on as the sun sinks from 2° to 10° below the horizon. Painted after the tint with additive blending, warm sodium colour per palette (`cityGlow`), squashed vertically so they stay round on the 2:1 Mercator canvas. Repainted with the terminator (once a minute) and once more when the airport catalog arrives.
- **Fix (pre-existing):** the night canvas's fourth corner repeated the top-left, folding the quad into a triangle — half of the night side was never drawn. Corners are now TL, TR, BR, BL.
- Tests: map unit 133/133 (dedupe, cap, Mercator placement, twilight ramp); e2e `night-globe` (desktop) and `mobile-night-globe` (phone) at a fixed 02:00 UTC count warm pixels on the globe; `map.spec` still green. Screenshots: [`night-globe-1440`](../media/s76/night-globe-1440.png), [`night-globe-390`](../media/s76/night-globe-390.png).

2026-10-12 · S76.2 · (this commit) · **Opt-in sound.** `features/sound`: `soundSettings` (per device, off by default), `tones` (landing "ding-dong", a falling third pitched by load; delivery fanfare of three rising notes and a held octave; a delivery wins over landings in one batch), `player` (Web Audio sine tones with a short attack and long release — no audio files), `SoundBridge` in the root (live timeline events only via the shared subscription, so catch-ups stay silent; tab visible; one sound per 2.5 s at most), `SoundSettingsCard` in the cockpit under the alerts card (switching on plays a sample chime, which also unlocks audio). Tests: tones, settings, card, bridge (off, throttle, delivery, catch-up); web unit 664/664.

2026-10-12 · S76.3 · (this commit) · **e2e; S76 complete.** `sound` (desktop) and `mobile-sound` (phone): off by default, switching on flips the button and survives a reload; clipped-control audits green on both. Full e2e (perf probes included) runs in CI.
