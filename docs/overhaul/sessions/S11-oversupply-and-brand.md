# S11 — Oversupply curve + brand score v2

> **Status:** ☑ merged
> **Next step:** — (merged in #172)
> **Branch:** `claude/zen-darwin-3op878`
> **PR:** #172
>
> **Track:** Economy · **Size:** M (3 steps) · **Depends on:** S10 · **Unblocks:** S12
>
> Resume rules: [`../STATUS.md`](../STATUS.md). One step = one commit, pushed immediately, with the progress log updated in the same commit.

## Goal

Over-assigning aircraft degrades smoothly, and brand rewards good service rather than full planes at any price.

## Why (evidence)

- Ledger A3 (double penalty: 14% vs ~24%) and A6 (brand rises with LF > 0.85, rewarding gouging).

## Read first

- `demand.ts` `calculateSupplyPressure`
- `FlightEngine.ts` per-flight pax formula
- `engineSlice.ts` brand update

## In scope

- Ruleset fields for the pressure curve and brand inputs (V2 or V3)

## Out of scope

- Market model (S10).

## Steps (checkpoints)

Each step leaves `pnpm lint && pnpm typecheck && pnpm test` green and is committed + pushed on its own. Tick the box in the same commit.

- [x] **S11.1** Single-application oversupply curve (ruleset) + tests. _Done when:_ monotone curve test green.
- [x] **S11.2** Brand v2 inputs (fair-price band, condition, healthy LF band) + tests. _Done when:_ tests green.
- [x] **S11.3** S02 over-assignment curve + brand trajectories; commit report. _Done when:_ greedy loses brand, balanced gains.

## Details & guidance

- Apply oversupply once (either frequency division or pressure), so LF tracks seats/demand with a soft floor.
- Brand inputs: fare vs market (fair-price band), maintenance state/condition, and LF only within a healthy band (60–90%).
- S02: add an over-assignment curve chart (1–20 planes) and a brand trajectory for greedy vs balanced strategies.

## Acceptance criteria

- [x] The over-assignment curve is monotone and smooth.
- [x] The greedy strategy loses brand over 30 simulated days; balanced gains it.

## Progress log

Append one line per checkpoint (newest last). Format: `YYYY-MM-DD · step · commit sha · note`. If you stop mid-step, add a `WIP` line saying exactly what is done and what remains.

2026-10-06 · S11.1 · (this commit) · Oversupply is now applied once. New core `supplyLoadFactor(seats, demand) = min(0.88, demand/seats)` is the expected LF; `calculateSupplyPressure` is redefined as the per-flight multiplier `clamp(0.88·seats/demand, 0.88, 1)`, so frequency division alone thins flights (at 2× supply LF is 0.50, was ~0.21). The multiplier stays at the ceiling when undersupplied so the engine's per-cabin seat cap still binds (a lower value starved a 10-seat first-only cabin). Web demand snapshot now uses `supplyLoadFactor` (it was already read as an LF). No ruleset object exists (D2: rules change in place), so the curve lives in `demand.ts`; no soft floor beyond demand/seats — a floor would put phantom passengers on empty routes. Monotone/continuous tests for 1–20 aircraft and fine-grained seat sweeps.
2026-10-06 · S11.2 · (this commit) · Brand v2. New core `brand.ts` `brandServiceGrade({loadFactor, fareRatio, condition})` ∈ [-1, 1]. Penalties ramp linearly and add up: economy fare above 1.2× the market reference (full at 1.5×), condition below 0.6 (full at 0.3), LF below 0.5 (full at 0.2). With no penalty, +1 only for LF in 60–90%, otherwise neutral. Landing details now carry `fareRatio` and `aircraftCondition`. The engine slice moves brand by the average grade × the existing per-tick rates (+0.002/h, −0.003/h) and clamps to [0.1, 1]. The old rule (LF > 0.85 ⇒ up) is gone. The market reference is `getSuggestedFares`, the same reference the S10 incumbent uses.
2026-10-06 · S11.3 · (this commit) · Balance report §6–7 (`balance/brand.ts`). The curve is ATR 72 × 1–20 on MAD–LIS at max frequency: LF 87→77→67→…→27%, monotone, no step above 0.1; 10 aircraft fly at 40%, was 19%. Brand over 30 days: balanced (2 ATRs, 1×) 0.50→0.87; over-assigned (10 ATRs) 0.50→0.37; gouging (2× fares) 0.50→0.13. Both checks are asserted in `report.test.ts`. Brand dynamics change from S11.2: the old per-tick rate (+0.002/h only on ticks with a landing) moved a 10-aircraft airline about 0.0001/day, so it was effectively inert. `nextBrandScore` now closes 1/400 of the gap to the grade's target (0.1–0.9) per landing, in closed form via `detPow`. Side effect of S11.1 visible in the report: the README §6 'decisions matter' target fell from ✅ CV 0.52 to ❌ CV 0.21, because thin routes are no longer double-punished and every sampled MAD route is now profitable (see Follow-ups).

## Follow-ups

- **Route-choice spread (README §6 'decisions matter')** regressed to CV 0.21 after S11.1 removed the double oversupply penalty. Thin markets now break even with the right aircraft. It needs a tuning pass (e.g. cost per seat on short sectors, or demand scaling for small airports) in an economy session after S12. It is not fixed here, so that the oversupply fix stays isolated.

## Handoff notes

- **Shipped.**
  - Oversupply is applied once: `supplyLoadFactor` and a redefined `calculateSupplyPressure`.
  - Brand v2 grades each landing on fair fare, aircraft condition and a healthy LF band, and pulls the brand toward the grade's target.
  - Balance report §6–7 shows the curve and the brand trajectories.
- **Gotchas.**
  - The pressure multiplier must stay at the ceiling when a route is undersupplied. Otherwise small cabins (first-only) get starved by rounding before the seat cap applies.
  - Brand now moves meaningfully: about 78% of the way to its target in a month for a 10-aircraft airline. QSI weights brand, so market shares will drift more than before.
- **Not done.** The route-spread regression (see Follow-ups).
