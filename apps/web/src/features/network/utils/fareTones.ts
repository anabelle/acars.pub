import { calculatePriceElasticity, type FixedPoint, fpToNumber } from "@acars/core";

/** Colour and parsing helpers shared by the route list and the fare editor. */

export const toneDotClass = {
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
} as const;

export const toneTextClass = {
  emerald: "text-emerald-400",
  amber: "text-amber-400",
  rose: "text-rose-400",
  muted: "text-muted-foreground",
} as const;

export const getFareTone = (actual: FixedPoint, suggested: FixedPoint) => {
  const actualValue = fpToNumber(actual);
  const suggestedValue = fpToNumber(suggested);
  if (suggestedValue <= 0) return null;
  const ratio = actualValue / suggestedValue;
  if (ratio <= 1) return "emerald" as const;
  if (ratio <= 1.2) return null;
  if (ratio <= 1.5) return "amber" as const;
  return "rose" as const;
};

export const getElasticityTone = (multiplier: number) => {
  if (multiplier >= 0.85) return "emerald" as const;
  if (multiplier >= 0.6) return "amber" as const;
  return "rose" as const;
};

export const formatSignedPercent = (value: number) => {
  const signed = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${signed}${Math.abs(value).toFixed(0)}%`;
};

export const parseFareInput = (value: string) => {
  const parsed = parseInt(value.replace(/[^0-9]/g, ""), 10);
  return Number.isNaN(parsed) ? null : parsed;
};

export const calculateElasticityDisplay = (
  actualFare: FixedPoint,
  referenceFare: FixedPoint,
  elasticity: number,
) => {
  const multiplier = calculatePriceElasticity(actualFare, referenceFare, elasticity);
  const referenceValue = fpToNumber(referenceFare);
  const actualValue = fpToNumber(actualFare);
  const ratio = referenceValue > 0 ? actualValue / referenceValue : 1;
  const deltaPercent = referenceValue > 0 ? (ratio - 1) * 100 : 0;
  return { multiplier, deltaPercent };
};
