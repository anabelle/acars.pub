import { fpScale } from './fixed-point.js';
import type { AircraftModel, FixedPoint } from './types.js';
import { TICKS_PER_HOUR } from './types.js';

/**
 * Calculates the current book value of an aircraft based on straight-line depreciation,
 * condition penalties, and utilization penalties.
 */
export function calculateBookValue(
    model: AircraftModel,
    flightHoursTotal: number,
    condition: number, // 0.0 to 1.0
    manufactureTick: number,
    currentTick: number
): FixedPoint {
    // 1. Calculate Age in Years
    const ticksPerDay = TICKS_PER_HOUR * 24;
    const ticksPerYear = ticksPerDay * 365;
    const ageTicks = Math.max(0, currentTick - manufactureTick);
    const ageYears = Math.floor(ageTicks / ticksPerYear);

    // 2. Declining Balance Depreciation (Exponential)
    // Most aircraft lose 8-12% of their value per year.
    // We use a 10% annual depreciation rate for a realistic curve.
    const annualRate = 0.10;
    const residualPercent = model.residualValuePercent / 100;
    const residualValue = fpScale(model.price, residualPercent);

    // V = P * (1-r)^t
    let baseValue = fpScale(model.price, Math.pow(1 - annualRate, ageYears));

    // 3. Apply Condition Penalty (Up to 30% reduction)
    // 100% condition = 0 penalty. 50% condition = 15% penalty.
    const conditionPenalty = (1 - condition) * 0.3;
    baseValue = fpScale(baseValue, 1 - conditionPenalty);

    // 4. Heavy Utilization Penalty
    // Average utilization is model.blockHoursPerDay.
    // Penalize if the flight hour density is high.
    const expectedHours = (model.blockHoursPerDay * 365) * ageYears;
    const utilizationRatio = expectedHours > 100 ? flightHoursTotal / expectedHours : 1.0;

    if (utilizationRatio > 1.2) {
        // High wear penalty (extra 10%)
        baseValue = fpScale(baseValue, 0.9);
    }

    // 5. Floor at residual value
    return (baseValue > residualValue ? baseValue : residualValue);
}
