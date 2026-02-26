import { useMemo } from "react";
import type { DemandResult, Route } from "@airtr/core";
import {
  calculateDemand,
  calculateSupplyPressure,
  getHubCongestionModifier,
  getHubDemandModifier,
  getProsperityIndex,
  getSeason,
  scaleToAddressableMarket,
} from "@airtr/core";
import { airports, HUB_CLASSIFICATIONS } from "@airtr/data";
import { useAirlineStore, useEngineStore } from "@airtr/store";

export type RouteDemandSnapshot = {
  totalDemand: DemandResult;
  addressableDemand: DemandResult;
  pressureMultiplier: number;
  totalWeeklySeats: number;
  suggestedFleetDelta: number;
  isOversupplied: boolean;
};

const DEFAULT_DEMAND: DemandResult = {
  origin: "",
  destination: "",
  economy: 0,
  business: 0,
  first: 0,
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function getRouteDemandSnapshot(
  route: Route,
  tick: number,
  fleet: RouteDemandFleet,
): RouteDemandSnapshot {
  const originIata = route.originIata;
  const destinationIata = route.destinationIata;
  const origin = airports.find((airport) => airport.iata === originIata) ?? null;
  const destination = airports.find((airport) => airport.iata === destinationIata) ?? null;

  if (!origin || !destination) {
    return {
      totalDemand: { ...DEFAULT_DEMAND, origin: originIata, destination: destinationIata },
      addressableDemand: { ...DEFAULT_DEMAND, origin: originIata, destination: destinationIata },
      pressureMultiplier: 0.15,
      totalWeeklySeats: 0,
      suggestedFleetDelta: 0,
      isOversupplied: false,
    };
  }

  const now = new Date();
  const season = getSeason(destination.latitude, now);
  const prosperity = getProsperityIndex(tick);

  const originHub = originIata ? (HUB_CLASSIFICATIONS[originIata] ?? null) : null;
  const destHub = destinationIata ? (HUB_CLASSIFICATIONS[destinationIata] ?? null) : null;
  const originState =
    originHub && originIata
      ? {
          hubIata: originIata,
          spokeCount: 0,
          weeklyFrequency: 0,
          avgFrequency: 0,
        }
      : null;
  const destState =
    destHub && destinationIata
      ? {
          hubIata: destinationIata,
          spokeCount: 0,
          weeklyFrequency: 0,
          avgFrequency: 0,
        }
      : null;
  const hubModifier = getHubDemandModifier(
    originHub?.tier ?? null,
    destHub?.tier ?? null,
    originState,
    destState,
  );

  const originTraffic = 0;
  const destTraffic = 0;
  const originCapacity = originHub?.baseCapacityPerHour ?? 80;
  const destCapacity = destHub?.baseCapacityPerHour ?? 80;
  const originCongestion = getHubCongestionModifier(originCapacity, originTraffic);
  const destCongestion = getHubCongestionModifier(destCapacity, destTraffic);
  const congestionModifier = (originCongestion + destCongestion) / 2;

  const weeklyDemand = calculateDemand(origin, destination, season, prosperity, hubModifier);

  const totalDemand: DemandResult = {
    origin: originIata,
    destination: destinationIata,
    economy: Math.round(weeklyDemand.economy * congestionModifier),
    business: Math.round(weeklyDemand.business * congestionModifier),
    first: Math.round(weeklyDemand.first * congestionModifier),
  };

  const addressableDemand = scaleToAddressableMarket(totalDemand);

  const totalWeeklySeats = route.assignedAircraftIds.reduce((sum, aircraftId) => {
    const aircraft = fleet.find((item) => item.id === aircraftId);
    if (!aircraft) return sum;
    const cabin = aircraft.configuration ?? { economy: 0, business: 0, first: 0, cargoKg: 0 };
    return sum + (cabin.economy + cabin.business + cabin.first) * 7;
  }, 0);

  const weeklyAddressableTotal =
    addressableDemand.economy + addressableDemand.business + addressableDemand.first;
  const pressureMultiplier = calculateSupplyPressure(totalWeeklySeats, weeklyAddressableTotal);
  const isOversupplied = totalWeeklySeats > weeklyAddressableTotal;

  const targetLf = 0.85;
  const targetSeats =
    weeklyAddressableTotal > 0 ? Math.round((weeklyAddressableTotal * targetLf) / 7) : 0;

  const averageSeats =
    route.assignedAircraftIds.length > 0
      ? Math.round(totalWeeklySeats / Math.max(1, route.assignedAircraftIds.length))
      : 0;

  const suggestedFleetDelta =
    averageSeats > 0
      ? clamp(Math.round((targetSeats - totalWeeklySeats / 7) / averageSeats), -9, 9)
      : 0;

  return {
    totalDemand,
    addressableDemand,
    pressureMultiplier,
    totalWeeklySeats,
    suggestedFleetDelta,
    isOversupplied,
  };
}

type RouteDemandFleet = {
  id: string;
  configuration?: { economy: number; business: number; first: number; cargoKg: number };
}[];

export function useRouteDemand(route: Route): RouteDemandSnapshot {
  const tick = useEngineStore((state) => state.tick);
  const fleet = useAirlineStore((state) => state.fleet);

  return useMemo(() => getRouteDemandSnapshot(route, tick, fleet), [route, tick, fleet]);
}
