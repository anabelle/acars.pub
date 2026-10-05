import type { AircraftInstance, AircraftModel, FixedPoint, FlightOffer, Route } from "@acars/core";
import { fpToNumber, getMaxFares, getMaxRouteDistanceKm, getSuggestedFares } from "@acars/core";
import type { RouteProjectionInput } from "@acars/store";

/** Fare presets as a multiple of the suggested fare for the distance. */
export const FARE_PRESETS = {
  aggressive: 0.85,
  suggested: 1,
  premium: 1.25,
} as const;

export type FarePresetId = keyof typeof FARE_PRESETS;

export interface FareValues {
  economy: number;
  business: number;
  first: number;
}

/** Whole-dollar fares for a preset, never above the fare cap. */
export function presetFares(distanceKm: number, preset: FarePresetId): FareValues {
  const suggested = getSuggestedFares(distanceKm);
  const max = getMaxFares(distanceKm);
  const factor = FARE_PRESETS[preset];
  const pick = (base: FixedPoint, cap: FixedPoint) =>
    Math.min(Math.round(fpToNumber(base) * factor), Math.floor(fpToNumber(cap)));
  return {
    economy: pick(suggested.economy, max.economy),
    business: pick(suggested.business, max.business),
    first: pick(suggested.first, max.first),
  };
}

/** The preset the fares match exactly, if any (highlights the active chip). */
export function matchingPreset(distanceKm: number, fares: FareValues): FarePresetId | null {
  for (const preset of Object.keys(FARE_PRESETS) as FarePresetId[]) {
    const values = presetFares(distanceKm, preset);
    if (
      values.economy === fares.economy &&
      values.business === fares.business &&
      values.first === fares.first
    ) {
      return preset;
    }
  }
  return null;
}

/**
 * Everything `projectRouteEconomics` needs to forecast a route except its
 * fares, taken from how the route flies today: its first assigned aircraft's
 * model and seats, how many aircraft fly it and its weekly frequency. Null
 * when no aircraft flies the route (nothing to project).
 */
export function fareProjectionBase(input: {
  route: Pick<
    Route,
    "originIata" | "destinationIata" | "distanceKm" | "assignedAircraftIds" | "frequencyPerWeek"
  >;
  fleet: ReadonlyArray<Pick<AircraftInstance, "id" | "modelId" | "configuration">>;
  getModel: (modelId: string) => AircraftModel | undefined;
  tick: number;
  tier: number;
  brandScore: number;
  playerPubkey: string;
  competitorOffers: FlightOffer[];
  networkRoutes: RouteProjectionInput["networkRoutes"];
}): Omit<RouteProjectionInput, "fares"> | null {
  const { route } = input;
  const flying = route.assignedAircraftIds
    .map((id) => input.fleet.find((aircraft) => aircraft.id === id))
    .filter((aircraft): aircraft is NonNullable<typeof aircraft> => Boolean(aircraft));
  const primary = flying[0];
  const model = primary ? input.getModel(primary.modelId) : undefined;
  if (!primary || !model) return null;
  return {
    originIata: route.originIata,
    destinationIata: route.destinationIata,
    distanceKm: route.distanceKm,
    model,
    aircraftCount: flying.length,
    frequencyPerWeek: route.frequencyPerWeek,
    seatConfig: {
      economy: primary.configuration.economy,
      business: primary.configuration.business,
      first: primary.configuration.first,
    },
    tick: input.tick,
    competitorOffers: input.competitorOffers,
    playerPubkey: input.playerPubkey,
    playerBrandScore: input.brandScore,
    distanceLimitKm: getMaxRouteDistanceKm(input.tier),
    networkRoutes: input.networkRoutes,
  };
}
